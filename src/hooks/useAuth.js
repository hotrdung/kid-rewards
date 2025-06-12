// src/hooks/useAuth.js
/* global __initial_auth_token */
import { useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut // Renamed to avoid conflict
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp, addDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { usersCollectionPath, familiesCollectionPath, getFamilyScopedCollectionPath } from '../utils/firestorePaths';
import { SYSTEM_ADMIN_EMAILS } from '../constants/appConstants';
import { migrateDataToFamily } from '../services/dataMigration';


export const useAuth = () => {
    const [firebaseAuthUser, setFirebaseAuthUser] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null); // This will store our app-specific user profile
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    // Effect for Firebase Auth State Change
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setAuthLoading(true);
            setAuthError('');
            setFirebaseAuthUser(user);

            if (user && !user.isAnonymous) {
                const userDocRef = doc(db, usersCollectionPath, user.uid);
                let userDocSnap;
                try {
                    userDocSnap = await getDoc(userDocRef);
                } catch (e) {
                    setAuthError("Failed to fetch user profile.");
                    setAuthLoading(false);
                    setIsAuthReady(true);
                    return;
                }

                const currentIsSA = SYSTEM_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');
                let storedProfileData = userDocSnap.exists() ? userDocSnap.data() : {};
                
                // Preserve activeFamilyRole if user is already logged in (e.g. page refresh)
                let determinedInitialActiveFamilyRole = storedProfileData.activeFamilyRole || null;
                if (loggedInUser && loggedInUser.uid === user.uid && firebaseAuthUser && firebaseAuthUser.uid === user.uid) {
                    determinedInitialActiveFamilyRole = loggedInUser.activeFamilyRole;
                }


                let userProfileData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    isSA: currentIsSA,
                    familyRoles: storedProfileData.familyRoles || [],
                    activeFamilyRole: determinedInitialActiveFamilyRole,
                    defaultFamilyDataMigrated: storedProfileData.defaultFamilyDataMigrated || false,
                };

                if (!userDocSnap.exists()) {
                    await setDoc(userDocRef, { ...userProfileData, createdAt: Timestamp.now(), totalEarnedPoints: 0 });
                } else {
                    let updates = {};
                    if (storedProfileData.isSA !== currentIsSA) updates.isSA = currentIsSA;
                    if (userProfileData.email !== storedProfileData.email) updates.email = userProfileData.email;
                    if (userProfileData.displayName !== storedProfileData.displayName) updates.displayName = userProfileData.displayName;
                    if (Object.keys(updates).length > 0) {
                        await updateDoc(userDocRef, updates);
                    }
                }
                
                // SA Default Family & Data Migration Logic
                if (userProfileData.isSA && (!userProfileData.familyRoles || userProfileData.familyRoles.filter(r => r.role === 'parent').length === 0)) {
                    const defaultFamilyName = `${userProfileData.displayName || 'Admin'}'s Default Family`;
                    try {
                        const newFamilyRef = await addDoc(collection(db, familiesCollectionPath), {
                            familyName: defaultFamilyName,
                            createdAt: Timestamp.now(),
                            createdBy: user.uid,
                            saDefaultFamily: true,
                        });
                        const defaultFamilyId = newFamilyRef.id;
                        const newParentRole = { familyId: defaultFamilyId, role: 'parent', familyName: defaultFamilyName };

                        let migrationSuccessful = true;
                        if (!userProfileData.defaultFamilyDataMigrated) {
                            migrationSuccessful = await migrateDataToFamily(defaultFamilyId, user.uid, userProfileData.displayName, setAuthError);
                        }
                        const updatedRoles = [...userProfileData.familyRoles, newParentRole];
                        await updateDoc(userDocRef, {
                            familyRoles: updatedRoles,
                            activeFamilyRole: newParentRole,
                            defaultFamilyDataMigrated: userProfileData.defaultFamilyDataMigrated || migrationSuccessful,
                        });
                        userProfileData.familyRoles = updatedRoles;
                        userProfileData.activeFamilyRole = newParentRole;
                        userProfileData.defaultFamilyDataMigrated = userProfileData.defaultFamilyDataMigrated || migrationSuccessful;
                    } catch (famError) { setAuthError("Could not set up default family. " + famError.message); }
                }

                // Update family names in roles
                if (userProfileData.familyRoles && userProfileData.familyRoles.length > 0) {
                    const rolesWithUpToDateNames = await Promise.all(
                        userProfileData.familyRoles.map(async (fr) => {
                            let currentFamilyName = fr.familyName || "Unknown Family"; // Use existing if present
                            // Only fetch if name is missing, "Unknown", or "Error"
                            if (currentFamilyName === "Unknown Family" || currentFamilyName === "Error: Family Name" || !fr.familyName) {
                                try {
                                    const familyDocSnap = await getDoc(doc(db, familiesCollectionPath, fr.familyId));
                                    currentFamilyName = familyDocSnap.exists() ? familyDocSnap.data().familyName : "Unknown Family";
                                } catch (famNameError) {
                                    console.error(`Error fetching family name for ${fr.familyId}:`, famNameError);
                                    currentFamilyName = "Error: Family Name";
                                }
                            }
                            return { ...fr, familyName: currentFamilyName };
                        })
                    );
                    userProfileData.familyRoles = rolesWithUpToDateNames;

                    // Ensure activeFamilyRole also has the updated name
                    if (userProfileData.activeFamilyRole) {
                        const activeRoleDetails = rolesWithUpToDateNames.find(
                            r => r.familyId === userProfileData.activeFamilyRole.familyId && r.role === userProfileData.activeFamilyRole.role
                        );
                        if (activeRoleDetails) {
                            userProfileData.activeFamilyRole = activeRoleDetails;
                        } else if (rolesWithUpToDateNames.length > 0) { // Fallback if active role somehow became invalid
                            userProfileData.activeFamilyRole = rolesWithUpToDateNames[0];
                        } else {
                            userProfileData.activeFamilyRole = null;
                        }
                    } else if (rolesWithUpToDateNames.length > 0) { // If no active role, set one
                         userProfileData.activeFamilyRole = rolesWithUpToDateNames[0];
                    }
                }

                // Associate kid profile if not SA and no roles
                if (!userProfileData.isSA && user.email && (!userProfileData.familyRoles || userProfileData.familyRoles.length === 0)) {
                    console.log(`User ${user.email} is not SA and has no family roles. Attempting to find kid profile across families.`);
                    const allFamiliesSnapshot = await getDocs(collection(db, familiesCollectionPath));
                    const allCurrentFamiliesList = allFamiliesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                    for (const family of allCurrentFamiliesList) {
                        const kidsPath = getFamilyScopedCollectionPath(family.id, 'kids');
                        const kidsQuery = query(collection(db, kidsPath), where("email", "==", user.email.toLowerCase()));
                        const kidDocsSnapshot = await getDocs(kidsQuery);

                        if (!kidDocsSnapshot.empty) {
                            const kidDocInFamily = kidDocsSnapshot.docs[0];
                            if (kidDocInFamily.data().authUid !== user.uid) {
                                await updateDoc(doc(db, kidsPath, kidDocInFamily.id), { authUid: user.uid });
                            }
                            const newKidRole = { familyId: family.id, role: 'kid', familyName: family.familyName };
                            await updateDoc(userDocRef, { familyRoles: arrayUnion(newKidRole), activeFamilyRole: newKidRole });
                            userProfileData.familyRoles.push(newKidRole);
                            userProfileData.activeFamilyRole = newKidRole;
                            console.log(`Associated ${user.email} as kid in family ${family.familyName}`);
                            break; 
                        }
                    }
                }
                setLoggedInUser(userProfileData);

            } else { // Anonymous or no user
                setLoggedInUser(null);
                try {
                    if (!auth.currentUser || !auth.currentUser.isAnonymous) { // Ensure we only sign in anonymously if not already anon or no user
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(auth, __initial_auth_token);
                        } else {
                            await signInAnonymously(auth);
                        }
                    }
                } catch (anonAuthError) {
                    setAuthError("Failed to initialize a base session.");
                }
            }
            setIsAuthReady(true);
            setAuthLoading(false);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // loggedInUser and firebaseAuthUser removed to prevent re-runs that could wipe activeFamilyRole selection

    const handleLoginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            setAuthError('');
            await signInWithPopup(auth, provider);
            // onAuthStateChanged will handle the rest
        } catch (googleAuthError) {
            if (googleAuthError.code !== 'auth/popup-closed-by-user') {
                setAuthError("Failed to sign in with Google.");
            }
        }
    };

    const handleLogout = async () => {
        try {
            await firebaseSignOut(auth);
            setLoggedInUser(null); // Clear app-specific user profile
            // onAuthStateChanged will set firebaseAuthUser to null and trigger anonymous sign-in
        } catch (logoutError) {
            setAuthError("Failed to sign out.");
        }
    };
    
    const updateLoggedInUser = (updater) => {
        setLoggedInUser(updater);
    };

    return { firebaseAuthUser, loggedInUser, updateLoggedInUser, isAuthReady, authLoading, authError, setAuthError, handleLoginWithGoogle, handleLogout, SYSTEM_ADMIN_EMAILS };
};
