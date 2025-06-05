/* global __firebase_config, __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithCustomToken,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    setDoc, 
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    Timestamp,
    writeBatch,
    arrayUnion, 
} from 'firebase/firestore';
import {
    PlusCircle, Edit3, Trash2, CheckCircle, Gift, User, LogOut, DollarSign, ListChecks,
    Award, Users, ClipboardList, Trophy, Bell, CalendarDays, Repeat, UserCheck, LogIn,
    ThumbsUp, ThumbsDown, ArrowUpCircle, ArrowDownCircle, Mail, ChevronsUpDown, RefreshCcw, AlertTriangle, Star,
    PackageCheck, PackageX, Eye, UsersRound, ShieldPlus, Building, UserCog, UserPlus, Coins,
    HomeIcon, AlertCircle, Info, MoreHorizontal 
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : { 
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
        appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID"
    };

const currentAppId = typeof __app_id !== 'undefined' 
    ? __app_id
    : (process.env.REACT_APP_CHORE_APP_ID || 'kid-rewards-app-multifamily-v3'); 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- System Admin Email Configuration ---
const SA_EMAILS_STR = process.env.REACT_APP_SA_EMAILS || ""; 
const SYSTEM_ADMIN_EMAILS = SA_EMAILS_STR.split(',').map(email => email.trim().toLowerCase()).filter(email => email);

// --- Firestore Path Helpers ---
const getGlobalCollectionPath = (collectionName) => `/artifacts/${currentAppId}/${collectionName}`;
const getFamilyScopedCollectionPath = (familyId, collectionName) => `/artifacts/${currentAppId}/families/${familyId}/${collectionName}`;
const getOldPublicDataCollectionPath = (collectionName) => `/artifacts/${currentAppId}/public/data/${collectionName}`;


const usersCollectionPath = getGlobalCollectionPath('users');
const familiesCollectionPath = getGlobalCollectionPath('families');

// --- Date Helper Functions (Unchanged) ---
const getStartOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
const getEndOfDay = (date) => { const d = new Date(date); d.setHours(23,59,59,999); return d; };
const getStartOfWeek = (date) => { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return getStartOfDay(new Date(d.setDate(diff))); };
const getEndOfWeek = (date) => { const startOfWeek = getStartOfWeek(date); const d = new Date(startOfWeek); d.setDate(d.getDate() + 6); return getEndOfDay(d); };
const getStartOfMonth = (date) => getStartOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
const getEndOfMonth = (date) => getEndOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS_SHORT = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
const calculateNextDueDate = (task, fromDateInput = new Date()) => { /* Unchanged */ const fromDate = getStartOfDay(new Date(fromDateInput)); if (!task.recurrenceType || task.recurrenceType === 'none') { return task.customDueDate ? Timestamp.fromDate(getStartOfDay(new Date(task.customDueDate))) : null; } let startDate = task.startDate ? getStartOfDay(new Date(task.startDate)) : getStartOfDay(new Date()); let candidateDate = new Date(Math.max(fromDate.getTime(), startDate.getTime())); if (task.nextDueDate && task.nextDueDate.toDate) { const currentNextDue = getStartOfDay(task.nextDueDate.toDate()); if (currentNextDue >= fromDate && currentNextDue >= startDate) { candidateDate = new Date(currentNextDue); } } if (candidateDate < startDate) candidateDate = new Date(startDate); switch (task.recurrenceType) { case 'daily': if (candidateDate <= fromDate) candidateDate.setDate(candidateDate.getDate() + 1); if (candidateDate < startDate) candidateDate = new Date(startDate); break; case 'weekly': if (!task.daysOfWeek || task.daysOfWeek.length === 0) return null; const selectedDayIndexes = task.daysOfWeek.map(day => DAYS_OF_WEEK.indexOf(day)).sort((a, b) => a - b); if (selectedDayIndexes.length === 0) return null; let attempts = 0; const currentDayOfCandidate = candidateDate.getDay(); if (candidateDate <= fromDate && !(selectedDayIndexes.includes(currentDayOfCandidate) && candidateDate.getTime() === fromDate.getTime()) ) { candidateDate.setDate(candidateDate.getDate() + 1); } if (candidateDate < startDate) candidateDate = new Date(startDate); while (attempts < 14) { const dayOfWeek = candidateDate.getDay(); for (const selectedDay of selectedDayIndexes) { if (selectedDay >= dayOfWeek) { const potentialDate = new Date(candidateDate); potentialDate.setDate(potentialDate.getDate() + (selectedDay - dayOfWeek)); if (potentialDate >= startDate && potentialDate >= fromDate) { return Timestamp.fromDate(getStartOfDay(potentialDate)); } } } candidateDate.setDate(candidateDate.getDate() + (7 - dayOfWeek));  if (candidateDate < startDate) candidateDate = new Date(startDate);  attempts++; } return null;  case 'monthly': const targetDayOfMonth = new Date(task.startDate).getDate();  if (candidateDate <= fromDate || candidateDate.getDate() > targetDayOfMonth) { if (candidateDate.getDate() > targetDayOfMonth && candidateDate.getMonth() === fromDate.getMonth() && candidateDate.getFullYear() === fromDate.getFullYear()){ /* same month but past target day */ } else { candidateDate.setMonth(candidateDate.getMonth() + 1); } } candidateDate.setDate(targetDayOfMonth); while (candidateDate.getDate() !== targetDayOfMonth) { candidateDate.setDate(targetDayOfMonth-1); candidateDate.setMonth(candidateDate.getMonth() + 1); candidateDate.setDate(targetDayOfMonth); } while (candidateDate < startDate) { candidateDate.setMonth(candidateDate.getMonth() + 1); candidateDate.setDate(targetDayOfMonth); while (candidateDate.getDate() !== targetDayOfMonth) { candidateDate.setDate(targetDayOfMonth-1); candidateDate.setMonth(candidateDate.getMonth() + 1); candidateDate.setDate(targetDayOfMonth); }} return Timestamp.fromDate(getStartOfDay(candidateDate)); default: return null; } return Timestamp.fromDate(getStartOfDay(candidateDate)); };

// --- Helper Components (Unchanged) ---
const Modal = ({ isOpen, onClose, title, children, size = "max-w-md" }) => { if (!isOpen) return null; return (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className={`bg-white p-6 rounded-lg shadow-xl w-full ${size} max-h-[90vh] overflow-y-auto`}><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold text-gray-700">{title}</h3><button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div>{children}</div></div>); };
const ConfirmationModal = ({ isOpen, onClose, title, message, onConfirm, confirmText = "Confirm", cancelText = "Cancel", children }) => { if (!isOpen) return null; return ( <Modal isOpen={isOpen} onClose={onClose} title={title} size="max-w-md"> <p className="text-gray-600 mb-6">{message}</p> {children && <div className="mb-4">{children}</div>} <div className="flex justify-end space-x-3"> <Button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800" icon={null}>{cancelText}</Button> <Button onClick={onConfirm} className="bg-red-500 hover:bg-red-600" icon={AlertTriangle}>{confirmText}</Button> </div> </Modal> ); };
const Button = ({ onClick, children, className = 'bg-blue-500 hover:bg-blue-600', icon: Icon, disabled = false, type = "button" }) => ( <button type={type} onClick={onClick} disabled={disabled} className={`flex items-center justify-center text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>{Icon && <Icon size={18} className="mr-2" />} {children}</button>);
const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false, name, min, max }) => ( <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} min={min} max={max} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" /></div>);
const SelectField = ({ label, value, onChange, options, placeholder, name, required = false }) => ( <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><select name={name} value={value} onChange={onChange} required={required} className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}>{placeholder && <option value="">{placeholder}</option>}{options.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}</select></div>);
const DayOfWeekSelector = ({ selectedDays, onChange, name = "daysOfWeek" }) => { const toggleDay = (day) => { const newSelectedDays = selectedDays.includes(day) ? selectedDays.filter(d => d !== day) : [...selectedDays, day]; onChange({ target: { name, value: newSelectedDays } }); }; return (<div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Days of Week (for Weekly)</label><div className="flex space-x-1 sm:space-x-2">{DAYS_OF_WEEK.map((day, index) => (<button type="button" key={day} onClick={() => toggleDay(day)} className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-md border text-xs sm:text-sm font-medium transition-colors w-full ${selectedDays.includes(day) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>{DAY_LABELS_SHORT[index]}</button>))}</div></div>); };
const TextAreaField = ({ label, value, onChange, placeholder, name, rows = 3 }) => ( <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" /></div>);
const Card = ({ children, className = '' }) => (<div className={`bg-white shadow-lg rounded-xl p-6 ${className}`}>{children}</div>);
const StarIconDisplay = ({ count, className = "text-yellow-400", size = 18 }) => { if (count <= 0) return null; return ( <span className="flex items-center"> {Array.from({ length: count }).map((_, i) => ( <Star key={i} size={size} className={`${className} fill-current mr-0.5`} /> ))} </span> ); };

// --- Data Migration Function (Unchanged) ---
const migrateDataToFamily = async (familyId, saUserId, saDisplayName, reportErrorFunc) => { console.log(`Starting data migration to family ${familyId} for SA ${saUserId}`); const collectionsToMigrate = ['kids', 'tasks', 'rewards', 'completedTasks', 'redeemedRewards']; let success = true; for (const collectionName of collectionsToMigrate) { const oldPath = getOldPublicDataCollectionPath(collectionName); const newBasePath = getFamilyScopedCollectionPath(familyId, collectionName); try { const oldDocsSnap = await getDocs(collection(db, oldPath)); if (oldDocsSnap.empty) { console.log(`No documents found in old path: ${oldPath}. Skipping migration for this collection.`); continue; } console.log(`Migrating ${oldDocsSnap.size} documents from ${oldPath} to ${newBasePath}`); const batch = writeBatch(db); oldDocsSnap.docs.forEach(oldDoc => { const newDocRef = doc(collection(db, newBasePath)); let dataToMigrate = oldDoc.data(); if (collectionName === 'kids') { dataToMigrate.familyId = familyId; dataToMigrate.totalEarnedPoints = dataToMigrate.totalEarnedPoints || 0; /* Initialize if missing */ } batch.set(newDocRef, dataToMigrate); }); await batch.commit(); console.log(`Successfully migrated ${collectionName} to family ${familyId}.`); } catch (error) { console.error(`Error migrating collection ${collectionName} from ${oldPath}:`, error); if (reportErrorFunc) { reportErrorFunc(`Migration error for ${collectionName}: ${error.message}`); } success = false; } } return success; };


// --- Main App Component ---
function App() {
    const [firebaseAuthUser, setFirebaseAuthUser] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null); 
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [allFamiliesForSA, setAllFamiliesForSA] = useState([]); 
    const [kids, setKids] = useState([]); 
    const [tasks, setTasks] = useState([]); 
    const [rewards, setRewards] = useState([]); 
    const [completedTasks, setCompletedTasks] = useState([]); 
    const [redeemedRewardsData, setRedeemedRewardsData] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setErrorState] = useState('');
    
    const setError = (message) => { console.error("Global Error Set:", message); setErrorState(message); };

    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, children: null });
    const showConfirmation = (title, message, onConfirmAction, confirmText = "Confirm", modalChildren = null) => { setConfirmModalState({ isOpen: true, title, message, onConfirm: onConfirmAction, confirmText, children: modalChildren }); };
    const closeConfirmation = () => setConfirmModalState(prev => ({ ...prev, isOpen: false, children: null }));

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setIsLoading(true);
            setErrorState(''); 
            setFirebaseAuthUser(user); 

            if (user && !user.isAnonymous) {
                const userDocRef = doc(db, usersCollectionPath, user.uid);
                let userDocSnap;
                try { userDocSnap = await getDoc(userDocRef); } 
                catch (e) { setError("Failed to fetch user profile."); setIsLoading(false); setIsAuthReady(true); return; }

                const currentIsSA = SYSTEM_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');
                
                let storedProfileData = {};
                if (userDocSnap.exists()) {
                    storedProfileData = userDocSnap.data();
                }

                let userProfileData = {
                    uid: user.uid, email: user.email, displayName: user.displayName,
                    isSA: currentIsSA, 
                    familyRoles: storedProfileData.familyRoles || [],
                    activeFamilyRole: storedProfileData.activeFamilyRole || null,
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
                            migrationSuccessful = await migrateDataToFamily(defaultFamilyId, user.uid, userProfileData.displayName, setError);
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
                    } catch (famError) { setError("Could not set up default family. " + famError.message); }
                }
                
                if (userProfileData.familyRoles && userProfileData.familyRoles.length > 0) {
                    const fetchedFamilies = allFamiliesForSA.reduce((acc, fam) => { 
                        acc[fam.id] = fam.familyName;
                        return acc;
                    }, {});

                    const rolesWithUpToDateNames = await Promise.all(
                        userProfileData.familyRoles.map(async (fr) => {
                            let currentFamilyName = fetchedFamilies[fr.familyId];
                            if (!currentFamilyName || currentFamilyName === "Unknown Family" || currentFamilyName === "Error: Family Name") { 
                                try {
                                    const familyDocSnap = await getDoc(doc(db, familiesCollectionPath, fr.familyId));
                                    currentFamilyName = familyDocSnap.exists() ? familyDocSnap.data().familyName : "Unknown Family";
                                    fetchedFamilies[fr.familyId] = currentFamilyName; 
                                } catch (famNameError) {
                                    console.error(`Error fetching family name for ${fr.familyId}:`, famNameError);
                                    currentFamilyName = "Error: Family Name";
                                }
                            }
                            return { ...fr, familyName: currentFamilyName };
                        })
                    );
                    userProfileData.familyRoles = rolesWithUpToDateNames;

                    if (userProfileData.activeFamilyRole) {
                        const activeRoleDetails = rolesWithUpToDateNames.find(
                            r => r.familyId === userProfileData.activeFamilyRole.familyId && r.role === userProfileData.activeFamilyRole.role
                        );
                        if (activeRoleDetails) {
                            userProfileData.activeFamilyRole = activeRoleDetails; 
                        } else if (rolesWithUpToDateNames.length > 0) { 
                             userProfileData.activeFamilyRole = rolesWithUpToDateNames[0]; 
                        } else { 
                            userProfileData.activeFamilyRole = null;
                        }
                    } else if (rolesWithUpToDateNames.length > 0) { 
                        userProfileData.activeFamilyRole = rolesWithUpToDateNames[0];
                    }
                }
                
                if (!userProfileData.isSA && user.email && (!userProfileData.familyRoles || userProfileData.familyRoles.length === 0)) {
                    console.log(`User ${user.email} is not SA and has no family roles. Attempting to find kid profile across families.`);
                    const allCurrentFamiliesList = allFamiliesForSA.length > 0 ? allFamiliesForSA : (await getDocs(collection(db, familiesCollectionPath))).docs.map(d => ({id: d.id, ...d.data()}));

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

            } else { 
                setLoggedInUser(null); 
                 try {
                    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } 
                        else { await signInAnonymously(auth); }
                    }
                } catch (authError) { setError("Failed to initialize a base session."); }
            }
            setIsAuthReady(true);
            setIsLoading(false); 
        });
        return () => unsubscribe();
    }, [allFamiliesForSA]); 


    useEffect(() => {
        if (!isAuthReady || !firebaseAuthUser) { setIsLoading(false); return; }
        let unsubscribes = []; setIsLoading(true);
        if (loggedInUser?.isSA && !loggedInUser.activeFamilyRole) { 
            const familiesQuery = query(collection(db, familiesCollectionPath));
            unsubscribes.push(onSnapshot(familiesQuery, (snapshot) => { setAllFamiliesForSA(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); }, err => console.error("Error fetching families:", err)));
        }
        if (loggedInUser?.activeFamilyRole?.familyId) {
            const familyId = loggedInUser.activeFamilyRole.familyId;
            const collectionsToFetch = [
                { pathGetter: getFamilyScopedCollectionPath, name: 'kids', setter: setKids },
                { pathGetter: getFamilyScopedCollectionPath, name: 'tasks', setter: setTasks },
                { pathGetter: getFamilyScopedCollectionPath, name: 'rewards', setter: setRewards },
                { pathGetter: getFamilyScopedCollectionPath, name: 'completedTasks', setter: setCompletedTasks },
                { pathGetter: getFamilyScopedCollectionPath, name: 'redeemedRewards', setter: setRedeemedRewardsData },
            ];
            collectionsToFetch.forEach(col => {
                const q = query(collection(db, col.pathGetter(familyId, col.name)));
                unsubscribes.push(onSnapshot(q, (snapshot) => { col.setter(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); }, (err) => { console.error(`Error fetching ${col.name} for family ${familyId}:`, err); setError(`Failed to load ${col.name}.`); }));
            });
        } else { setKids([]); setTasks([]); setRewards([]); setCompletedTasks([]); setRedeemedRewardsData([]); }
        setIsLoading(false); return () => unsubscribes.forEach(unsub => unsub());
    }, [isAuthReady, firebaseAuthUser, loggedInUser]);

    const handleLoginWithGoogle = async () => { const provider = new GoogleAuthProvider(); try { setErrorState(''); await signInWithPopup(auth, provider); } catch (googleAuthError) { if (googleAuthError.code !== 'auth/popup-closed-by-user') { setError("Failed to sign in with Google."); }}};
    const handleLogout = async () => { try { await signOut(auth); setLoggedInUser(null); } catch (logoutError) { setError("Failed to sign out."); }};

    const switchToAdminView = () => { if (loggedInUser?.isSA) { setLoggedInUser(prev => ({ ...prev, activeFamilyRole: null })); } };
    const switchToFamilyView = (familyRole) => { 
        const familyFromList = allFamiliesForSA.find(f => f.id === familyRole.familyId);
        const updatedRole = familyFromList ? { ...familyRole, familyName: familyFromList.familyName } : familyRole;
        setLoggedInUser(prev => ({ ...prev, activeFamilyRole: updatedRole })); 
    };

    if (!isAuthReady || isLoading) { return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold">Initializing App & Loading Data...</div></div>; }
    if (error) { return <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4"><div className="text-xl font-semibold text-red-500 p-4 bg-red-100 rounded-md mb-4">{error}</div><Button onClick={() => {setErrorState(''); window.location.reload();}} className="bg-blue-500 hover:bg-blue-600">Try Again</Button></div>; }
    
    if (!firebaseAuthUser || (firebaseAuthUser.isAnonymous && (!loggedInUser || (!loggedInUser.isSA && !loggedInUser.activeFamilyRole)))) {
        return ( <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex flex-col items-center justify-center p-4"><div className="text-center mb-12"><Award size={60} className="text-yellow-300 mx-auto mb-4" /><h1 className="text-5xl font-bold text-white mb-4">Kid Rewards</h1><p className="text-xl text-purple-200">Login with Google to continue.</p></div><Card className="w-full max-w-md"><h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">Sign In</h2><Button onClick={handleLoginWithGoogle} className="w-full mb-4 bg-red-500 hover:bg-red-600 text-white" icon={LogIn}>Login with Google</Button><p className="text-xs text-gray-500 text-center mt-4">Parents and Kids with registered emails can log in here.</p></Card>{SYSTEM_ADMIN_EMAILS.length === 0 && process.env.NODE_ENV === 'development' && (<p className="mt-4 text-sm text-yellow-300 bg-black bg-opacity-20 p-2 rounded">Dev Note: No SA emails configured.</p>)}</div>);
    }

    if (!loggedInUser?.uid) {
        return (<div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-4 text-white"><Award size={60} className="text-yellow-400 mx-auto mb-4" /><h1 className="text-4xl font-bold mb-4">Welcome!</h1><p className="text-lg mb-6">Processing your account details...</p></div>);
    }

    let viewToRender;
    if (loggedInUser.isSA && !loggedInUser.activeFamilyRole) { 
        viewToRender = <SystemAdminDashboard user={loggedInUser} families={allFamiliesForSA} showConfirmation={showConfirmation} switchToFamilyView={switchToFamilyView} migrateDataToFamilyFunc={migrateDataToFamily} setErrorFunc={setError} />;
    } else if (loggedInUser.activeFamilyRole?.role === 'parent') {
        viewToRender = <ParentDashboard user={loggedInUser} familyId={loggedInUser.activeFamilyRole.familyId} kids={kids} tasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewardsData={redeemedRewardsData} showConfirmation={showConfirmation} allRewardsGlobal={rewards} switchToAdminViewFunc={switchToAdminView} />;
    } else if (loggedInUser.activeFamilyRole?.role === 'kid') {
        const kidProfile = kids.find(k => k.authUid === loggedInUser.uid || k.email?.toLowerCase() === loggedInUser.email?.toLowerCase());
        if (kidProfile) {
            viewToRender = <KidDashboard kidData={{...kidProfile, points: kidProfile.points || 0, totalEarnedPoints: kidProfile.totalEarnedPoints || 0}} familyId={loggedInUser.activeFamilyRole.familyId} allTasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewardsData={redeemedRewardsData} showConfirmation={showConfirmation} />;
        } else { viewToRender = <div className="text-center p-8"><p className="text-xl text-red-500">Your kid profile was not found in family "{loggedInUser.activeFamilyRole.familyName}".</p><p>Please contact your parent.</p></div>; }
    } else { 
         viewToRender = (<div className="text-center p-8"><h2 className="text-2xl font-semibold mb-4">Welcome, {loggedInUser.displayName}!</h2><p>Your role is not fully set up for a family view.</p>{loggedInUser.isSA && <p>You are a System Admin. <Button onClick={switchToAdminView}>Go to Admin Dashboard</Button></p>}{loggedInUser.familyRoles?.length === 0 && !loggedInUser.isSA && <p>Please ask an Admin or Parent to add you to a family.</p>}</div>);
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center">
                       <Award size={32} className="text-purple-600 mr-2" />
                       <h1 className="text-2xl font-bold text-gray-700">Kid Rewards</h1>
                       {loggedInUser.activeFamilyRole && <span className="ml-2 text-sm text-gray-500 hidden sm:inline">({loggedInUser.activeFamilyRole.familyName})</span>}
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <span className="text-sm text-gray-600 hidden sm:block">
                            {loggedInUser.displayName}
                            {loggedInUser.isSA && <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">SA</span>}
                        </span>
                        
                        {/* Contextual View Indicators - Buttons moved to dashboard cards */}
                        {loggedInUser.isSA && !loggedInUser.activeFamilyRole && (
                             <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700 hidden md:inline">
                                Admin Dashboard
                            </span>
                        )}
                        {loggedInUser.activeFamilyRole?.role === 'parent' && (
                             <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-700">
                                Parent View
                            </span>
                        )}
                        {!loggedInUser.isSA && loggedInUser.activeFamilyRole?.role === 'kid' && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">Kid View</span>
                        )}

                        <Button onClick={handleLogout} className="bg-gray-500 hover:bg-gray-600 px-2 sm:px-4" icon={LogOut}><span className="hidden sm:inline">Logout</span></Button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6">{viewToRender}</main>
            <ConfirmationModal isOpen={confirmModalState.isOpen} onClose={closeConfirmation} title={confirmModalState.title} message={confirmModalState.message} onConfirm={() => { confirmModalState.onConfirm(); closeConfirmation(); }} confirmText={confirmModalState.confirmText} children={confirmModalState.children} />
            <footer className="text-center py-6 text-gray-500 text-sm">&copy; {new Date().getFullYear()} Kid Rewards App. App ID: {currentAppId}</footer>
        </div>);
}

// --- SystemAdminDashboard (Includes "Enter Family View" buttons in its card) ---
const SystemAdminDashboard = ({ user, families, showConfirmation, switchToFamilyView, migrateDataToFamilyFunc, setErrorFunc }) => { 
    const [activeTab, setActiveTab] = useState('manageFamilies'); 
    const NavItem = ({ tabName, icon: Icon, label }) => ( <button onClick={() => setActiveTab(tabName)} className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-150 ${activeTab === tabName ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-blue-100'}`}><Icon size={20} className="mr-2" /> {label}</button>); 
    
    const parentRoles = user.familyRoles?.filter(r => r.role === 'parent') || [];

    return ( 
    <div className="space-y-6"> 
        <Card> 
            <h2 className="text-3xl font-semibold text-gray-800 mb-1">System Admin Dashboard</h2> 
            <p className="text-gray-600 mt-1">Manage families and application settings.</p> 
            {parentRoles.length > 0 && (
                 <div className="mt-4 border-t pt-4">
                    <h4 className="text-md font-semibold mb-2 text-gray-700">Enter a Family as Parent:</h4>
                    <div className="flex flex-wrap gap-2">
                        {parentRoles.map(role => (
                            <Button 
                                key={role.familyId} 
                                onClick={() => switchToFamilyView(role)} 
                                className="bg-purple-500 hover:bg-purple-600 text-sm" 
                                icon={HomeIcon}
                            >
                                Enter "{role.familyName}"
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            <ForceMigrateButton user={user} families={families} showConfirmation={showConfirmation} migrateFunc={migrateDataToFamilyFunc} setError={setErrorFunc} />
        </Card> 
        <nav className="bg-white shadow rounded-lg p-2"><div className="flex flex-wrap gap-2"><NavItem tabName="manageFamilies" icon={Building} label="Manage Families" /><NavItem tabName="manageFamilyParents" icon={UserCog} label="Manage Family Parents" /></div></nav> 
        <div> 
            {activeTab === 'manageFamilies' && <ManageFamilies families={families} showConfirmation={showConfirmation} currentUser={user} />} 
            {activeTab === 'manageFamilyParents' && <ManageFamilyParents families={families} showConfirmation={showConfirmation} currentUser={user} />} 
        </div> 
    </div>);
};

// --- ForceMigrateButton (Unchanged) ---
const ForceMigrateButton = ({ user, families, showConfirmation, migrateFunc, setError }) => { const defaultFamilyRole = user.familyRoles?.find(fr => { const family = families.find(f => f.id === fr.familyId); return family?.saDefaultFamily && fr.role === 'parent'; }); if (!user.isSA || !defaultFamilyRole) { return null; } const handleForceMigration = async () => { showConfirmation( "Force Data Migration", `This will attempt to migrate data from the old global path to your default family "${defaultFamilyRole.familyName}". This is usually a one-time operation. Proceed only if you are sure the automatic migration did not complete correctly. \n\nCheck console for details after running.`, async () => { if(setError) setError(''); console.log("Manually triggering migration for default family:", defaultFamilyRole.familyId); const success = await migrateFunc(defaultFamilyRole.familyId, user.uid, user.displayName, setError); if (success) { const userDocRef = doc(db, usersCollectionPath, user.uid); await updateDoc(userDocRef, { defaultFamilyDataMigrated: true }); alert("Data migration attempt completed. Please verify the data and check the console for details."); } else { alert("Data migration attempt encountered errors. Please check the console."); } }, "Force Migrate Now" ); }; return ( <div className="mt-6 p-4 border border-orange-400 bg-orange-50 rounded-md shadow"> <h4 className="text-md font-semibold text-orange-800 mb-2 flex items-center"> <AlertCircle size={20} className="mr-2 text-orange-600" /> Manual Data Migration Tool </h4> <p className="text-sm text-orange-700 mb-3"> If you suspect data from a previous app version (specifically from global paths) did not automatically migrate to your default family (<span className="font-semibold">{defaultFamilyRole.familyName}</span>), you can manually trigger the migration process. </p> <Button onClick={handleForceMigration} className="bg-orange-500 hover:bg-orange-600 text-white text-sm" icon={RefreshCcw} > Force Migrate to "{defaultFamilyRole.familyName}" </Button> {user.defaultFamilyDataMigrated && <p className="text-xs text-green-700 mt-2"><CheckCircle size={12} className="inline mr-1"/>Migration flag for default family is already set.</p>} {!user.defaultFamilyDataMigrated && <p className="text-xs text-yellow-700 mt-2"><Info size={12} className="inline mr-1"/>Migration flag not yet set.</p>} </div> );};

// --- ManageFamilies (SA - Unchanged) ---
const ManageFamilies = ({ families, showConfirmation, currentUser }) => { const [isModalOpen, setIsModalOpen] = useState(false); const [familyName, setFamilyName] = useState(''); const [editingFamily, setEditingFamily] = useState(null); const [formError, setFormError] = useState(''); const openAddModal = () => { setEditingFamily(null); setFamilyName(''); setFormError(''); setIsModalOpen(true); }; const openEditModal = (family) => { setEditingFamily(family); setFamilyName(family.familyName); setFormError(''); setIsModalOpen(true); }; const handleSaveFamily = async () => { if (!familyName.trim()) { setFormError('Family name is required.'); return; } setFormError(''); const familyData = { familyName: familyName.trim(), updatedAt: Timestamp.now(), updatedBy: currentUser.uid, }; try { if (editingFamily) { await updateDoc(doc(db, familiesCollectionPath, editingFamily.id), familyData); } else { familyData.createdAt = Timestamp.now(); familyData.createdBy = currentUser.uid; await addDoc(collection(db, familiesCollectionPath), familyData); } setIsModalOpen(false); } catch (e) { console.error("Error saving family:", e); setFormError("Failed to save family."); } }; const confirmDeleteFamily = (family) => { showConfirmation( "Delete Family", `Are you sure you want to delete the family "${family.familyName}"? This will delete ALL associated data (kids, tasks, rewards, history) and cannot be undone. THIS IS A PLACEHOLDER - FULL DATA DELETION REQUIRES SERVER-SIDE LOGIC.`, async () => { console.warn("Attempting to delete family doc. Cascading delete of subcollections needs server-side implementation."); try { await deleteDoc(doc(db, familiesCollectionPath, family.id)); } catch (e) { console.error("Error deleting family doc:", e); } } ); }; return ( <Card><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-semibold text-gray-700">Manage Families</h3><Button onClick={openAddModal} className="bg-green-500 hover:bg-green-600" icon={PlusCircle}>Add Family</Button></div>{families.length === 0 ? <p>No families created yet.</p> : (<ul className="space-y-3">{families.map(fam => (<li key={fam.id} className="flex justify-between items-center p-3 bg-gray-50 rounded"><span>{fam.familyName} <span className="text-xs text-gray-400">({fam.id})</span></span><div className="space-x-2"><Button onClick={() => openEditModal(fam)} icon={Edit3} className="bg-blue-500 hover:bg-blue-600 text-sm px-2 py-1">Edit</Button><Button onClick={() => confirmDeleteFamily(fam)} icon={Trash2} className="bg-red-500 hover:bg-red-600 text-sm px-2 py-1">Delete</Button></div></li>))}</ul>)}<Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFamily ? "Edit Family" : "Add New Family"}>{formError && <p className="text-red-500 text-sm mb-2">{formError}</p>}<InputField label="Family Name" value={familyName} onChange={e => setFamilyName(e.target.value)} required /><Button onClick={handleSaveFamily} className="w-full bg-green-500 hover:bg-green-600">{editingFamily ? "Save Changes" : "Create Family"}</Button></Modal></Card> );};
// --- ManageFamilyParents (SA - Unchanged) ---
const ManageFamilyParents = ({ families, showConfirmation, currentUser }) => { const [selectedFamilyId, setSelectedFamilyId] = useState(''); const [parentEmailToAdd, setParentEmailToAdd] = useState(''); const [formError, setFormError] = useState(''); const [feedback, setFeedback] = useState(''); const familyOptions = families.map(f => ({ value: f.id, label: f.familyName })); const handleAddParentToFamily = async () => { if (!selectedFamilyId || !parentEmailToAdd.trim()) { setFormError("Please select a family and enter the parent's email."); return; } setFormError(''); setFeedback(''); try { const usersQuery = query(collection(db, usersCollectionPath), where("email", "==", parentEmailToAdd.trim().toLowerCase())); const querySnapshot = await getDocs(usersQuery); if (querySnapshot.empty) { setFormError(`User with email ${parentEmailToAdd} not found. They need to log in to the app at least once.`); return; } const parentUserDoc = querySnapshot.docs[0]; const parentUserId = parentUserDoc.id; const parentUserData = parentUserDoc.data(); const existingRole = parentUserData.familyRoles?.find(r => r.familyId === selectedFamilyId && r.role === 'parent'); if (existingRole) { setFeedback(`${parentEmailToAdd} is already a parent in this family.`); return; } const familyDoc = families.find(f => f.id === selectedFamilyId); const newRole = { familyId: selectedFamilyId, role: 'parent', familyName: familyDoc?.familyName || "Unknown Family" }; showConfirmation( "Add Parent to Family", `Are you sure you want to add ${parentEmailToAdd} as a parent to family "${familyDoc?.familyName}"?`, async () => { await updateDoc(doc(db, usersCollectionPath, parentUserId), { familyRoles: arrayUnion(newRole) }); setFeedback(`${parentEmailToAdd} added as a parent to ${familyDoc?.familyName}.`); setParentEmailToAdd(''); } ); } catch (e) { console.error("Error adding parent to family:", e); setFormError("Failed to add parent. " + e.message); } }; return ( <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Assign Parent to Family</h3>{formError && <p className="text-red-500 text-sm mb-3 p-2 bg-red-100 rounded">{formError}</p>}{feedback && <p className="text-green-500 text-sm mb-3 p-2 bg-green-100 rounded">{feedback}</p>}<SelectField label="Select Family" value={selectedFamilyId} onChange={e => setSelectedFamilyId(e.target.value)} options={familyOptions} placeholder="-- Choose a Family --" /><InputField label="Parent's Email Address" type="email" value={parentEmailToAdd} onChange={e => setParentEmailToAdd(e.target.value)} placeholder="parent@example.com" /><Button onClick={handleAddParentToFamily} className="bg-blue-500 hover:bg-blue-600" icon={UserPlus} disabled={!selectedFamilyId || !parentEmailToAdd}>Add Parent</Button>{selectedFamilyId && <div className="mt-6"><h4 className="text-lg font-medium text-gray-600">Current Parents in {families.find(f=>f.id === selectedFamilyId)?.familyName || ''}:</h4><p className="text-sm text-gray-500">(Displaying this list requires querying the 'users' collection based on familyRoles - TBD)</p></div>}</Card> );};

// --- ParentDashboard (Moved SA Dash button into card, refactored Nav) ---
const ParentDashboard = ({ user, familyId, kids, tasks, rewards, completedTasks, redeemedRewardsData, showConfirmation, allRewardsGlobal, switchToAdminViewFunc }) => { 
    const [activeTab, setActiveTab] = useState('tasks'); 
    const [showMoreNav, setShowMoreNav] = useState(false);

    const pendingTasks = completedTasks.filter(task => task.status === 'pending_approval'); 
    const pendingFulfillmentRewards = redeemedRewardsData.filter(reward => reward.status === 'pending_fulfillment'); 

    const mainNavItems = [
        { name: 'tasks', icon: ClipboardList, label: "Tasks" },
        { name: 'rewards', icon: Trophy, label: "Rewards" },
        { name: 'approveTasks', icon: Bell, label: "Approvals", count: pendingTasks.length },
    ];
    const moreNavItems = [
        { name: 'kids', icon: Users, label: "Kids" },
        { name: 'fulfillRewards', icon: PackageCheck, label: "Fulfill Rewards", count: pendingFulfillmentRewards.length },
        { name: 'history', icon: ListChecks, label: "History" },
    ];
    
    const handleTabClick = (tabName, isFromMoreMenu = false) => {
        setActiveTab(tabName);
        if (isFromMoreMenu) {
            setShowMoreNav(false);
        }
    };
    
    const renderContent = () => { 
        switch (activeTab) { 
            case 'kids': return <ManageKids parentUser={user} familyId={familyId} kidsInFamily={kids} completedTasks={completedTasks} showConfirmation={showConfirmation} />; 
            case 'tasks': return <ManageTasks familyId={familyId} tasksInFamily={tasks} kidsInFamily={kids} showConfirmation={showConfirmation} />; 
            case 'rewards': return <ManageRewards familyId={familyId} rewardsInFamily={rewards} showConfirmation={showConfirmation} />; 
            case 'approveTasks': return <ApproveTasks familyId={familyId} pendingTasks={pendingTasks} kidsInFamily={kids} allTasksInFamily={tasks} showConfirmation={showConfirmation} firebaseUser={user} />; 
            case 'fulfillRewards': return <FulfillRewards familyId={familyId} pendingRewards={pendingFulfillmentRewards} kidsInFamily={kids} allRewardsList={rewards} showConfirmation={showConfirmation} firebaseUser={user} />; 
            case 'history': return <ParentRewardHistory familyId={familyId} redeemedRewards={redeemedRewardsData} completedTasks={completedTasks} kidsInFamily={kids} rewardsInFamily={rewards} tasksInFamily={tasks} />; 
            default: return <ManageTasks familyId={familyId} tasksInFamily={tasks} kidsInFamily={kids} showConfirmation={showConfirmation} />; 
        } 
    }; 
    
    return ( 
    <div className="space-y-6">
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start">
                <div>
                    <h2 className="text-3xl font-semibold text-gray-800 mb-1">Parent Dashboard</h2>
                    <p className="text-gray-600 mt-1">Family: <span className="font-medium">{user.activeFamilyRole.familyName}</span></p>
                </div>
                {user.isSA && (
                     <Button 
                        onClick={switchToAdminViewFunc} 
                        className="mt-2 sm:mt-0 bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-3" 
                        icon={UserCog}
                    >
                        SA Dashboard
                    </Button>
                )}
            </div>
        </Card>
        <nav className="bg-white shadow rounded-lg p-2">
            <div className="flex flex-wrap gap-1 sm:gap-2">
                {mainNavItems.map(item => (
                    <div key={item.name} className="flex-1 min-w-[80px] sm:min-w-0">
                        <NavItemButton 
                            tabName={item.name} 
                            icon={item.icon} 
                            label={item.label} 
                            count={item.count} 
                            currentActiveTab={activeTab} 
                            onTabClick={handleTabClick}
                        />
                    </div> 
                ))}
                <div className="relative flex-1 min-w-[80px] sm:min-w-0">
                    <button 
                        onClick={() => setShowMoreNav(!showMoreNav)} 
                        className={`flex items-center w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-sm text-gray-600 hover:bg-purple-100 ${showMoreNav ? 'bg-purple-100' : ''}`}
                    >
                        <MoreHorizontal size={18} className="mr-2 flex-shrink-0" /> <span className="flex-grow">More</span>
                    </button>
                    {showMoreNav && (
                        <div className="absolute right-0 sm:left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                            {moreNavItems.map(item => (
                                <NavItemButton 
                                    key={item.name} 
                                    tabName={item.name} 
                                    icon={item.icon} 
                                    label={item.label} 
                                    count={item.count} 
                                    currentActiveTab={activeTab} 
                                    onTabClick={(tabName) => handleTabClick(tabName, true)} // Pass true for isMoreItem
                                    isMoreItem={true} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </nav>
        <div>{renderContent()}</div>
    </div>); 
};

// New NavItemButton component (standalone)
const NavItemButton = ({ tabName, icon: Icon, label, count, isMoreItem = false, currentActiveTab, onTabClick }) => {
    const isActive = currentActiveTab === tabName;
    
    let buttonClasses = "flex items-center w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-sm ";
    if (isActive) {
        buttonClasses += isMoreItem ? 'bg-purple-500 text-white' : 'bg-purple-600 text-white shadow-md';
    } else {
        buttonClasses += 'text-gray-600 hover:bg-purple-100';
    }

    return (
        <button 
            onClick={() => onTabClick(tabName, isMoreItem)} 
            className={buttonClasses}
        >
            <Icon size={18} className="mr-2 flex-shrink-0" /> 
            <span className="flex-grow">{label}</span>
            {count > 0 && <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">{count}</span>}
        </button>
    );
};


// --- ManageKids (Parent - Updated to display pending and total earned points) ---
const ManageKids = ({ parentUser, familyId, kidsInFamily, completedTasks, showConfirmation }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false); const [kidName, setKidName] = useState(''); const [kidEmail, setKidEmail] = useState(''); const [editingKid, setEditingKid] = useState(null); const [formError, setFormError] = useState(''); 
    const openAddModal = () => { setEditingKid(null); setKidName(''); setKidEmail(''); setFormError(''); setIsModalOpen(true); }; 
    const openEditModal = (kid) => { setEditingKid(kid); setKidName(kid.name); setKidEmail(kid.email || ''); setFormError(''); setIsModalOpen(true); }; 
    const handleSaveKid = async () => { if (!kidName.trim()) { setFormError('Kid name is required.'); return; } if (kidEmail.trim() && !/\S+@\S+\.\S+/.test(kidEmail.trim())) { setFormError('Please enter a valid email address or leave it blank.'); return; } setFormError(''); const kidData = { name: kidName.trim(), email: kidEmail.trim().toLowerCase() || null, points: editingKid ? (editingKid.points || 0) : 0, totalEarnedPoints: editingKid ? (editingKid.totalEarnedPoints || 0) : 0, familyId: familyId, }; try { const kidsPath = getFamilyScopedCollectionPath(familyId, 'kids'); if (editingKid) { await updateDoc(doc(db, kidsPath, editingKid.id), kidData); } else { kidData.createdAt = Timestamp.now(); kidData.addedByParentUid = parentUser.uid; const newKidRef = await addDoc(collection(db, kidsPath), kidData); if (kidData.email) { const userQuery = query(collection(db, usersCollectionPath), where("email", "==", kidData.email)); const userSnap = await getDocs(userQuery); let kidAuthUid; if (!userSnap.empty) { kidAuthUid = userSnap.docs[0].id; const kidUserDocRef = doc(db, usersCollectionPath, kidAuthUid); const kidUserDoc = await getDoc(kidUserDocRef); if (kidUserDoc.exists() && !kidUserDoc.data().familyRoles?.find(fr => fr.familyId === familyId && fr.role === 'kid')) { await updateDoc(kidUserDocRef, { familyRoles: arrayUnion({familyId: familyId, role: 'kid', familyName: parentUser.activeFamilyRole.familyName}) }); } } if (kidAuthUid) { await updateDoc(doc(db, kidsPath, newKidRef.id), { authUid: kidAuthUid }); } } } setIsModalOpen(false); } catch (error) { console.error("Error saving kid: ", error); setFormError('Failed to save kid. ' + error.message); } }; 
    const confirmDeleteKid = (kid) => { showConfirmation( "Confirm Deletion", `Are you sure you want to delete kid "${kid.name}" from your family?`, () => handleDeleteKid(kid.id) ); }; 
    const handleDeleteKid = async (kidId) => { if (!kidId) return; try { await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), kidId)); } catch (error) { console.error("Error deleting kid: ", error); } }; 
    
    return ( 
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700">Kids in Family: {parentUser.activeFamilyRole.familyName}</h3>
                <Button onClick={openAddModal} className="bg-green-500 hover:bg-green-600 text-sm px-3 py-1.5" icon={PlusCircle}>
                    <span className="sm:hidden">+</span>
                    <span className="hidden sm:inline">Add Kid</span>
                </Button>
            </div>
            {kidsInFamily.length === 0 ? <p className="text-gray-500">No kids added to this family yet.</p> : (
                <ul className="space-y-3">
                    {kidsInFamily.map(kid => {
                        const pendingPoints = completedTasks?.filter(ct => ct.kidId === kid.id && ct.status === 'pending_approval').reduce((sum, ct) => sum + (ct.taskPoints || 0), 0) || 0;
                        return (
                            <li key={kid.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                                <div>
                                    <span className="font-medium text-lg text-gray-800">{kid.name}</span>
                                    <div className="text-sm space-x-2">
                                        <span className="text-purple-600 font-semibold">Current: {kid.points || 0} pts</span>
                                        <span className="text-green-600 font-semibold">Earned: {kid.totalEarnedPoints || 0} pts</span>
                                        {pendingPoints > 0 && <span className="text-yellow-600 font-semibold">Pending: {pendingPoints} pts</span>}
                                    </div>
                                    {kid.email && <p className="text-xs text-gray-500 mt-1 flex items-center"><Mail size={12} className="mr-1"/> {kid.email}</p>}
                                    {kid.authUid && <p className="text-xs text-gray-400 mt-1">Linked</p>}
                                </div>
                                <div className="flex space-x-2 mt-2 sm:mt-0">
                                    <Button onClick={() => openEditModal(kid)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm" icon={Edit3}>Edit</Button>
                                    <Button onClick={() => confirmDeleteKid(kid)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingKid ? "Edit Kid" : "Add New Kid"}>{formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}<InputField label="Kid's Name" value={kidName} onChange={e => setKidName(e.target.value)} placeholder="e.g., Alex" required /><InputField label="Kid's Email (Optional, for Google Login)" type="email" value={kidEmail} onChange={e => setKidEmail(e.target.value)} placeholder="e.g., alex@example.com" /><p className="text-xs text-gray-500 mb-3">If email is provided, the kid can log in using Google. They need to log in once for the system to link their account.</p><Button onClick={handleSaveKid} className="w-full bg-green-500 hover:bg-green-600">{editingKid ? "Save Changes" : "Add Kid"}</Button></Modal>
        </Card>
    );
};

// --- ManageTasks (Parent - Updated sorting and Add button) ---
const ManageTasks = ({ familyId, tasksInFamily, kidsInFamily, showConfirmation }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false); const [editingTask, setEditingTask] = useState(null); const [formError, setFormError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'startDate', direction: 'ascending' }); 
    const initialFormState = { name: '', points: '1', recurrenceType: 'none', daysOfWeek: [], startDate: new Date().toISOString().split('T')[0], customDueDate: '', assignedKidId: '' }; 
    const [formData, setFormData] = useState(initialFormState);
    const recurrenceOptions = [ { value: 'none', label: 'None (One-time or specific due date)' },{ value: 'daily', label: 'Daily' },{ value: 'weekly', label: 'Weekly' },{ value: 'monthly', label: 'Monthly (based on start date)' }];
    const kidOptions = [ { value: '', label: 'Unassigned (Any Kid)' }, ...kidsInFamily.map(k => ({ value: k.id, label: k.name }))];
    const handleInputChange = (e) => { const { name, value } = e.target; setFormData(prev => { const newState = { ...prev, [name]: value }; if (name === "startDate" && newState.recurrenceType === "weekly") { const newStartDateDay = DAYS_OF_WEEK[new Date(value + 'T00:00:00').getDay()]; if (newStartDateDay && !newState.daysOfWeek.includes(newStartDateDay)) { newState.daysOfWeek = [...newState.daysOfWeek, newStartDateDay]; }} if (name === "recurrenceType" && value !== "weekly") {newState.daysOfWeek = [];} return newState; }); };
    const handlePointChange = (amount) => { setFormData(prev => ({...prev, points: Math.max(1, (parseInt(prev.points) || 1) + amount).toString() })); };
    const openAddModal = () => { setEditingTask(null); setFormData({...initialFormState, startDate: new Date().toISOString().split('T')[0]}); setFormError(''); setIsModalOpen(true); };
    const openEditModal = (task) => { setEditingTask(task); setFormData({ name: task.name, points: task.points.toString(), recurrenceType: task.recurrenceType || 'none', daysOfWeek: task.daysOfWeek || [], startDate: task.startDate ? new Date(task.startDate + 'T00:00:00').toISOString().split('T')[0] : new Date().toISOString().split('T')[0], customDueDate: task.customDueDate ? new Date(task.customDueDate + 'T00:00:00').toISOString().split('T')[0] : '', assignedKidId: task.assignedKidId || '', }); setFormError(''); setIsModalOpen(true); };
    const handleSaveTask = async () => { if (!formData.name.trim() || !formData.points || isNaN(parseInt(formData.points)) || parseInt(formData.points) <= 0) { setFormError('Task name and a positive point value are required.'); return; } if (formData.recurrenceType === 'weekly' && formData.daysOfWeek.length === 0) { setFormError('Please select at least one day for weekly recurrence.'); return; } if (!formData.startDate) { setFormError('Start date is required.'); return; } if (formData.recurrenceType === 'none' && !formData.customDueDate) { setFormError('For non-recurring tasks, a specific Due Date is required.'); return; } if (formData.customDueDate && new Date(formData.customDueDate) < new Date(formData.startDate)) { setFormError('Due date cannot be before start date.'); return; } setFormError(''); const taskData = { name: formData.name.trim(), points: parseInt(formData.points), recurrenceType: formData.recurrenceType, daysOfWeek: formData.recurrenceType === 'weekly' ? formData.daysOfWeek : [], startDate: formData.startDate, customDueDate: formData.recurrenceType === 'none' && formData.customDueDate ? formData.customDueDate : null, assignedKidId: formData.assignedKidId || null, isActive: true, }; const baseDateForCalc = taskData.recurrenceType === 'none' ? new Date(taskData.customDueDate) : new Date(taskData.startDate); taskData.nextDueDate = calculateNextDueDate({ ...taskData }, baseDateForCalc); try { const tasksPath = getFamilyScopedCollectionPath(familyId, 'tasks'); if (editingTask) { await updateDoc(doc(db, tasksPath, editingTask.id), taskData); }  else { taskData.createdAt = Timestamp.now(); await addDoc(collection(db, tasksPath), taskData); } setIsModalOpen(false); } catch (error) { console.error("Error saving task: ", error); setFormError(`Failed to save task: ${error.message}`); } };
    const [taskToDelete, setTaskToDelete] = useState(null); const confirmDeleteTask = (task) => { setTaskToDelete(task); showConfirmation("Confirm Deletion", `Are you sure you want to delete task "${task.name}"?`, () => handleDeleteTask(task.id)); }; const handleDeleteTask = async (taskId) => { if(!taskId) return; try { await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'tasks'), taskId)); setTaskToDelete(null); } catch (error) { console.error("Error deleting task: ", error); setTaskToDelete(null); } };
    const sortedTasks = useMemo(() => { 
        let sortableItems = [...tasksInFamily]; 
        if (sortConfig.key !== null) { 
            sortableItems.sort((a, b) => { 
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (sortConfig.key === 'startDate') { 
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                }
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1; 
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1; 
                return 0; 
            }); 
        } 
        return sortableItems; 
    }, [tasksInFamily, sortConfig]);
    const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction }); };
    const getSortIcon = (key) => { if (sortConfig.key !== key) return <ChevronsUpDown size={16} className="ml-1 opacity-40" />; return sortConfig.direction === 'ascending' ? <ArrowUpCircle size={16} className="ml-1" /> : <ArrowDownCircle size={16} className="ml-1" />; };
    return ( 
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700">Tasks</h3>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2"> 
                    <Button onClick={() => requestSort('startDate')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Start Date {getSortIcon('startDate')}</Button>
                    <Button onClick={() => requestSort('points')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Points {getSortIcon('points')}</Button>
                    <Button onClick={openAddModal} className="bg-teal-500 hover:bg-teal-600 text-xs sm:text-sm px-3 py-1.5" icon={PlusCircle}>
                         <span className="sm:hidden">+</span>
                         <span className="hidden sm:inline">Add Task</span>
                    </Button>
                </div>
            </div>
            {sortedTasks.length === 0 ? <p className="text-gray-500">No tasks defined yet for this family.</p> : (<ul className="space-y-3">{sortedTasks.map(task => { const assignedKid = kidsInFamily.find(k => k.id === task.assignedKidId); let recurrenceDisplay = task.recurrenceType || 'None'; if (task.recurrenceType === 'weekly' && task.daysOfWeek?.length > 0) { recurrenceDisplay = `Weekly (${task.daysOfWeek.map(d => DAY_LABELS_SHORT[DAYS_OF_WEEK.indexOf(d)] || d).join(', ')})`; } else if (task.recurrenceType !== 'none') { recurrenceDisplay = task.recurrenceType.charAt(0).toUpperCase() + task.recurrenceType.slice(1); } return (<li key={task.id} className="p-4 bg-gray-50 rounded-lg shadow-sm"><div className="flex flex-col sm:flex-row justify-between sm:items-start"><div><span className="font-medium text-lg text-gray-800">{task.name}</span><span className="ml-4 text-sm text-teal-600 font-semibold">{task.points} points</span><p className="text-xs text-gray-500 mt-1">Recurrence: <span className="font-medium">{recurrenceDisplay}</span></p><p className="text-xs text-gray-500">Starts: <span className="font-medium">{task.startDate ? new Date(task.startDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</span>{task.customDueDate && task.recurrenceType === 'none' && ` | Due: ${new Date(task.customDueDate + 'T00:00:00').toLocaleDateString()}`}</p>{task.nextDueDate && task.recurrenceType !== 'none' && (<p className="text-xs text-gray-500">Next Due: <span className="font-medium">{task.nextDueDate.toDate().toLocaleDateString()}</span></p>)}<p className="text-xs text-gray-500">Assigned to: <span className="font-medium">{assignedKid ? assignedKid.name : 'Any Kid'}</span></p></div><div className="flex space-x-2 mt-2 sm:mt-0 flex-shrink-0"><Button onClick={() => openEditModal(task)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm" icon={Edit3}>Edit</Button><Button onClick={() => confirmDeleteTask(task)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button></div></div></li>);})}</ul>)}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? "Edit Task" : "Add New Task"} size="max-w-lg">{formError && <p className="text-red-500 text-sm mb-3 p-2 bg-red-100 rounded">{formError}</p>}<InputField label="Task Name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Clean room" required /><div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Points</label><div className="flex items-center space-x-2"><Button onClick={() => handlePointChange(-1)} icon={ArrowDownCircle} className="bg-red-400 hover:bg-red-500 px-2 py-1 text-sm" disabled={parseInt(formData.points) <= 1}/><input type="number" name="points" value={formData.points} onChange={handleInputChange} placeholder="e.g., 10" required min="1" className="w-20 text-center px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/><Button onClick={() => handlePointChange(1)} icon={ArrowUpCircle} className="bg-green-400 hover:bg-green-500 px-2 py-1 text-sm"/></div></div><InputField label="Start Date" name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} required /><SelectField label="Recurrence" name="recurrenceType" value={formData.recurrenceType} onChange={handleInputChange} options={recurrenceOptions} />{formData.recurrenceType === 'weekly' && ( <DayOfWeekSelector selectedDays={formData.daysOfWeek} onChange={handleInputChange} /> )}{formData.recurrenceType === 'none' && ( <InputField label="Specific Due Date (for Non-Recurring)" name="customDueDate" type="date" value={formData.customDueDate} onChange={handleInputChange} /> )}<SelectField label="Assign to Kid" name="assignedKidId" value={formData.assignedKidId} onChange={handleInputChange} options={kidOptions} placeholder="Unassigned (Any Kid)" /><Button onClick={handleSaveTask} className="w-full mt-4 bg-teal-500 hover:bg-teal-600">{editingTask ? "Save Changes" : "Add Task"}</Button></Modal>
        </Card>
    );
};

// --- ManageRewards (Parent - Updated sorting and Add button) ---
const ManageRewards = ({ familyId, rewardsInFamily, showConfirmation }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false); const [rewardName, setRewardName] = useState(''); const [rewardCost, setRewardCost] = useState(''); const [formError, setFormError] = useState(''); 
    const [sortConfig, setSortConfig] = useState({ key: 'pointCost', direction: 'descending' }); 
    const handleAddReward = async () => { setFormError(''); if (!rewardName.trim() || !rewardCost || isNaN(parseInt(rewardCost)) || parseInt(rewardCost) <= 0) { setFormError("Reward name and a positive point cost are required."); return; } try { await addDoc(collection(db, getFamilyScopedCollectionPath(familyId, 'rewards')), { name: rewardName.trim(), pointCost: parseInt(rewardCost), isAvailable: true, createdAt: Timestamp.now() }); setRewardName(''); setRewardCost(''); setIsModalOpen(false); } catch (error) { console.error("Error adding reward: ", error); setFormError("Failed to add reward."); } }; 
    const [rewardToDelete, setRewardToDelete] = useState(null); 
    const confirmDeleteReward = (reward) => { setRewardToDelete(reward); showConfirmation("Confirm Deletion", `Are you sure you want to delete reward "${reward.name}"?`, () => handleDeleteReward(reward.id)); }; 
    const handleDeleteReward = async (rewardId) => { if(!rewardId) return; try { await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'rewards'), rewardId)); setRewardToDelete(null); } catch (error) { console.error("Error deleting reward: ", error); setRewardToDelete(null); } }; 
    const sortedRewards = useMemo(() => { let sortableItems = [...rewardsInFamily]; if (sortConfig.key) { sortableItems.sort((a, b) => { let valA = a[sortConfig.key]; let valB = b[sortConfig.key]; if (sortConfig.key === 'createdAt' && valA?.toDate && valB?.toDate) { valA = valA.toMillis(); valB = valB.toMillis(); } if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1; return 0; }); } return sortableItems; }, [rewardsInFamily, sortConfig]); 
    const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } else if (sortConfig.key === key && sortConfig.direction === 'descending') { direction = 'ascending';} setSortConfig({ key, direction }); }; 
    const getSortIcon = (key) => { if (sortConfig.key !== key) return <ChevronsUpDown size={16} className="ml-1 opacity-40" />; return sortConfig.direction === 'ascending' ? <ArrowUpCircle size={16} className="ml-1" /> : <ArrowDownCircle size={16} className="ml-1" />; }; 
    return ( 
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700">Rewards</h3>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2"> 
                    <Button onClick={() => requestSort('name')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Name {getSortIcon('name')}</Button>
                    <Button onClick={() => requestSort('pointCost')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Points {getSortIcon('pointCost')}</Button>
                    <Button onClick={() => {setIsModalOpen(true); setFormError('');}} className="bg-yellow-500 hover:bg-yellow-600 text-xs sm:text-sm px-3 py-1.5" icon={PlusCircle}>
                        <span className="sm:hidden">+</span>
                        <span className="hidden sm:inline">Add Reward</span>
                    </Button>
                </div>
            </div>
            {sortedRewards.length === 0 ? <p className="text-gray-500">No rewards defined yet for this family.</p> : (<ul className="space-y-3">{sortedRewards.map(reward => (<li key={reward.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm"><div><span className="font-medium text-lg text-gray-800">{reward.name}</span><span className="ml-4 text-sm text-yellow-700 font-semibold">{reward.pointCost} points</span></div><Button onClick={() => confirmDeleteReward(reward)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button></li>))}</ul>)}
            <Modal isOpen={isModalOpen} onClose={() => {setIsModalOpen(false); setFormError('');}} title="Add New Reward">{formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}<InputField label="Reward Name" value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="e.g., Extra screen time" required /><InputField label="Point Cost" type="number" value={rewardCost} onChange={e => setRewardCost(e.target.value)} placeholder="e.g., 50" required min="1" /><Button onClick={handleAddReward} className="w-full bg-yellow-500 hover:bg-yellow-600">Add Reward</Button></Modal>
        </Card>
    );
};

// --- ApproveTasks (Parent - Updated to include totalEarnedPoints) ---
const ApproveTasks = ({ familyId, pendingTasks, kidsInFamily, allTasksInFamily, showConfirmation, firebaseUser }) => { 
    const [approvalNote, setApprovalNote] = useState(''); const [currentTaskForApproval, setCurrentTaskForApproval] = useState(null); const [pointsToAdjust, setPointsToAdjust] = useState(0); const [reopenTaskFlag, setReopenTaskFlag] = useState(true); 
    const openApprovalModal = (completedTask) => { setCurrentTaskForApproval(completedTask); setPointsToAdjust(completedTask.taskPoints); setApprovalNote(''); setReopenTaskFlag(true); }; 
    const closeApprovalModal = () => { setCurrentTaskForApproval(null); setApprovalNote(''); setPointsToAdjust(0); setReopenTaskFlag(false); }; 
    const handleConfirmApprovalAction = (status) => { const actionText = status === 'approved' ? 'approve' : (reopenTaskFlag ? 'reject and reopen' : 'reject'); const title = status === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'; showConfirmation( title, `Are you sure you want to ${actionText} this task submission for "${currentTaskForApproval?.taskName}"?`, () => processApprovalAction(status) ); }; 
    const processApprovalAction = async (status) => {  
        if (!currentTaskForApproval) return; 
        try { 
            const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), currentTaskForApproval.kidId); 
            const completedTaskRef = doc(db, getFamilyScopedCollectionPath(familyId, 'completedTasks'), currentTaskForApproval.id); 
            const mainTaskRef = doc(db, getFamilyScopedCollectionPath(familyId, 'tasks'), currentTaskForApproval.taskId); 
            const kidDoc = await getDoc(kidRef); 
            const mainTaskDoc = await getDoc(mainTaskRef); 
            if (!kidDoc.exists() || !mainTaskDoc.exists()) { console.error("Kid or Task document not found"); return; } 
            
            const currentKidData = kidDoc.data();
            const currentKidPoints = currentKidData.points || 0; 
            const currentTotalEarned = currentKidData.totalEarnedPoints || 0; 

            const mainTaskData = mainTaskDoc.data(); 
            const batch = writeBatch(db); 
            const approverInfo = firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System'; 
            
            if (status === 'rejected' && reopenTaskFlag) { batch.delete(completedTaskRef); } 
            else { 
                const updateData = { status: status, approvalNote: approvalNote.trim() || null, dateApprovedOrRejected: Timestamp.now(), pointsAwarded: status === 'approved' ? pointsToAdjust : 0, processedBy: approverInfo }; 
                batch.update(completedTaskRef, updateData); 
                if (status === 'approved') { 
                    batch.update(kidRef, { 
                        points: currentKidPoints + pointsToAdjust,
                        totalEarnedPoints: currentTotalEarned + pointsToAdjust 
                    }); 
                } 
            } 
            if (status === 'approved' && mainTaskData.recurrenceType && mainTaskData.recurrenceType !== 'none') { const newNextDueDate = calculateNextDueDate({ ...mainTaskData, startDate: new Date(mainTaskData.startDate), customDueDate: mainTaskData.customDueDate ? new Date(mainTaskData.customDueDate) : null, nextDueDate: currentTaskForApproval.taskDueDate }, currentTaskForApproval.taskDueDate.toDate()); if (newNextDueDate) { batch.update(mainTaskRef, { nextDueDate: newNextDueDate }); } } 
            await batch.commit(); 
            closeApprovalModal(); 
        } catch (error) { console.error(`Error ${status} task: `, error); } 
    }; 
    if (pendingTasks.length === 0) { return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Approve Tasks</h3><p className="text-gray-500">No tasks pending approval.</p></Card>; } 
    return ( <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Approve Tasks</h3><ul className="space-y-4">{pendingTasks.map(ct => { const kid = kidsInFamily.find(k => k.id === ct.kidId); if (!kid) return <li key={ct.id} className="text-red-500 p-3 bg-red-50 rounded-md">Kid data missing.</li>; return (<li key={ct.id} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center"><div className="mb-2 sm:mb-0"><p className="font-semibold text-lg text-gray-800">{kid.name} completed: <span className="text-blue-600">{ct.taskName}</span></p><p className="text-sm text-gray-500">Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()}</p><p className="text-sm text-gray-500">Originally Due: {ct.taskDueDate?.toDate().toLocaleDateString()}</p><p className="text-sm text-purple-600 font-semibold">Original Points: {ct.taskPoints}</p></div><Button onClick={() => openApprovalModal(ct)} className="bg-indigo-500 hover:bg-indigo-600" icon={Edit3}>Review</Button></li>);})}</ul><Modal isOpen={!!currentTaskForApproval} onClose={closeApprovalModal} title={`Review Task: ${currentTaskForApproval?.taskName}`}>{currentTaskForApproval && (<div><p><strong>Kid:</strong> {kidsInFamily.find(k => k.id === currentTaskForApproval.kidId)?.name}</p><p><strong>Submitted:</strong> {currentTaskForApproval.dateSubmitted?.toDate().toLocaleString()}</p><p><strong>Original Due:</strong> {currentTaskForApproval.taskDueDate?.toDate().toLocaleDateString()}</p><div className="my-4"><label className="block text-sm font-medium text-gray-700 mb-1">Adjust Points (Original: {currentTaskForApproval.taskPoints})</label><div className="flex items-center space-x-2"><Button onClick={() => setPointsToAdjust(p => Math.max(0, p - 1))} icon={ArrowDownCircle} className="bg-red-500 hover:bg-red-600 px-2 py-1"/><input type="number" value={pointsToAdjust} onChange={e => setPointsToAdjust(Math.max(0, parseInt(e.target.value) || 0))} className="w-20 text-center px-2 py-1 border border-gray-300 rounded-md"/><Button onClick={() => setPointsToAdjust(p => p + 1)} icon={ArrowUpCircle} className="bg-green-500 hover:bg-green-600 px-2 py-1"/></div></div><TextAreaField label="Approval/Rejection Note (Optional)" value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="e.g., Great job!" /><div className="mt-4 mb-2"><label className="flex items-center text-sm text-gray-600"><input type="checkbox" checked={reopenTaskFlag} onChange={(e) => setReopenTaskFlag(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />If rejecting, reopen task for kid to resubmit?</label></div><div className="flex justify-end space-x-3 mt-6"><Button onClick={() => handleConfirmApprovalAction('rejected')} className="bg-red-500 hover:bg-red-600" icon={ThumbsDown}>{reopenTaskFlag ? "Reject & Reopen" : "Reject Only"}</Button><Button onClick={() => handleConfirmApprovalAction('approved')} className="bg-green-500 hover:bg-green-600" icon={ThumbsUp}>Approve</Button></div></div>)}</Modal></Card>);};

// --- FulfillRewards (Parent - Unchanged) ---
const FulfillRewards = ({ familyId, pendingRewards, kidsInFamily, allRewardsList, showConfirmation, firebaseUser }) => { const [rewardToProcess, setRewardToProcess] = useState(null); const [cloneRewardOnFulfill, setCloneRewardOnFulfill] = useState(false); const [cancellationNote, setCancellationNote] = useState(""); const openFulfillModal = (redeemedReward) => { setRewardToProcess(redeemedReward); setCloneRewardOnFulfill(false); }; const openCancelModal = (redeemedReward) => { setRewardToProcess(redeemedReward); setCancellationNote(""); }; const closeModals = () => { setRewardToProcess(null); setCloneRewardOnFulfill(false); setCancellationNote(""); }; const handleFulfill = async () => { if (!rewardToProcess) return; const originalRewardDetails = allRewardsList.find(r => r.id === rewardToProcess.rewardId); showConfirmation( "Confirm Fulfillment", `Mark "${rewardToProcess.rewardName}" for ${kidsInFamily.find(k=>k.id === rewardToProcess.kidId)?.name} as fulfilled?`, async () => { try { const batch = writeBatch(db); const redeemedRewardRef = doc(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards'), rewardToProcess.id); batch.update(redeemedRewardRef, { status: 'fulfilled', dateFulfilled: Timestamp.now(), fulfilledBy: firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System', }); if (cloneRewardOnFulfill && originalRewardDetails) { const newRewardData = { ...originalRewardDetails, name: `${originalRewardDetails.name}`, createdAt: Timestamp.now(), isAvailable: true, }; delete newRewardData.id; const newRewardRef = doc(collection(db, getFamilyScopedCollectionPath(familyId, 'rewards'))); batch.set(newRewardRef, newRewardData); } await batch.commit(); closeModals(); } catch (error) { console.error("Error fulfilling reward:", error); } }, "Mark Fulfilled", <div><label className="flex items-center text-sm text-gray-700 mt-2"><input type="checkbox" checked={cloneRewardOnFulfill} onChange={(e) => setCloneRewardOnFulfill(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />Re-list this reward for future redemption (within this family)?</label></div> ); }; const handleCancelRequest = async () => { if (!rewardToProcess) return; showConfirmation( "Cancel Reward Request", `Cancel request for "${rewardToProcess.rewardName}" by ${kidsInFamily.find(k=>k.id === rewardToProcess.kidId)?.name}? Points will be returned.`, async () => { try { const batch = writeBatch(db); const redeemedRewardRef = doc(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards'), rewardToProcess.id); const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), rewardToProcess.kidId); const kidDoc = await getDoc(kidRef); if (!kidDoc.exists()) throw new Error("Kid not found"); const newPoints = (kidDoc.data().points || 0) + rewardToProcess.pointsSpent; batch.update(redeemedRewardRef, { status: 'cancelled_by_parent', dateCancelled: Timestamp.now(), cancellationNote: cancellationNote.trim() || null, cancelledBy: firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System', }); batch.update(kidRef, { points: newPoints }); await batch.commit(); closeModals(); } catch (error) { console.error("Error cancelling reward request:", error); } }, "Yes, Cancel & Return Points", <div><TextAreaField label="Reason for cancellation (optional):" value={cancellationNote} onChange={e => setCancellationNote(e.target.value)} placeholder="e.g., Item out of stock" /></div> ); }; if (pendingRewards.length === 0) { return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Fulfill Rewards</h3><p className="text-gray-500">No rewards pending fulfillment.</p></Card>; } return ( <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Fulfill Rewards</h3><ul className="space-y-4">{pendingRewards.map(rr => { const kid = kidsInFamily.find(k => k.id === rr.kidId); const rewardInfo = allRewardsList.find(r => r.id === rr.rewardId); return ( <li key={rr.id} className="p-4 bg-gray-50 rounded-lg shadow-sm"><div className="flex flex-col sm:flex-row justify-between items-start"><div><p className="font-semibold text-lg text-gray-800">{kid?.name || 'Unknown Kid'} redeemed: <span className="text-yellow-600">{rr.rewardName}</span></p><p className="text-sm text-gray-500">Requested: {rr.dateRedeemed?.toDate().toLocaleDateString()}</p><p className="text-sm text-gray-500">Cost: {rr.pointsSpent} points</p>{rewardInfo && <p className="text-xs text-gray-400 italic">Original reward ID (in family): {rewardInfo.id}</p>}</div><div className="flex space-x-2 mt-2 sm:mt-0"><Button onClick={() => openCancelModal(rr)} className="bg-red-500 hover:bg-red-600 text-sm" icon={PackageX}>Cancel</Button><Button onClick={() => openFulfillModal(rr)} className="bg-green-500 hover:bg-green-600 text-sm" icon={PackageCheck}>Fulfill</Button></div></div></li> );})}</ul></Card> );};
// --- ParentRewardHistory (Unchanged) ---
const ParentRewardHistory = ({ familyId, redeemedRewards, completedTasks, kidsInFamily, rewardsInFamily, tasksInFamily }) => { const [filterPeriod, setFilterPeriod] = useState('all'); const now = new Date(); const filterData = (data, dateField) => { if (filterPeriod === 'all') return data; return data.filter(item => { const itemDate = item[dateField]?.toDate(); if (!itemDate) return false;
        if (filterPeriod === 'today') return getStartOfDay(itemDate).getTime() === getStartOfDay(now).getTime();
        if (filterPeriod === 'week') return itemDate >= getStartOfWeek(now) && itemDate <= getEndOfWeek(now);
        if (filterPeriod === 'month') return itemDate >= getStartOfMonth(now) && itemDate <= getEndOfMonth(now);
        return true;
    });
};
const filteredRedeemed = filterData(redeemedRewards, 'dateRedeemed').sort((a,b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis());
const filteredCompleted = filterData(completedTasks.filter(ct => ct.status === 'approved' || ct.status === 'rejected'), 'dateApprovedOrRejected').sort((a,b) => b.dateApprovedOrRejected.toMillis() - a.dateApprovedOrRejected.toMillis());

return (
    <Card>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-gray-700">History</h3>
            <SelectField
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                options={[{value: 'all', label: 'All Time'}, {value: 'today', label: 'Today'}, {value: 'week', label: 'This Week'}, {value: 'month', label: 'This Month'}]}
            />
        </div>
        <div className="mb-8">
            <h4 className="text-xl font-semibold text-gray-600 mb-3">Redeemed Rewards</h4>
            {filteredRedeemed.length === 0 ? (
                <p className="text-gray-500">No rewards activity.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kid</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRedeemed.map(rr => {
                                const k=kidsInFamily.find(k=>k.id===rr.kidId);
                                return (
                                    <tr key={rr.id} className={rr.status === 'cancelled_by_parent' ? 'bg-red-50' : (rr.status === 'fulfilled' ? 'bg-green-50' : 'bg-yellow-50')}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{rr.dateRedeemed?.toDate().toLocaleDateString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{k?.name||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{rr.rewardName||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{rr.pointsSpent}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{rr.status?.replace(/_/g, ' ') || 'Pending'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{rr.fulfilledBy || rr.cancelledBy || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        <div>
            <h4 className="text-xl font-semibold text-gray-600 mb-3">Task Submissions</h4>
            {filteredCompleted.length === 0 ? (
                <p className="text-gray-500">No tasks submitted/reviewed.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date Reviewed</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kid</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCompleted.map(ct => {
                                const k=kidsInFamily.find(k=>k.id===ct.kidId);
                                return (
                                    <tr key={ct.id} className={ct.status === 'rejected' ? 'bg-red-50' : (ct.status === 'approved' ? 'bg-green-50' : '')}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{ct.dateApprovedOrRejected?.toDate().toLocaleDateString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{k?.name||ct.kidName||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{ct.taskName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                                            <span className={`${ct.status === 'approved' ? 'text-green-600' : (ct.status === 'rejected' ? 'text-red-600' : 'text-yellow-600')}`}>
                                                {ct.status?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{ct.pointsAwarded || 0}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{ct.processedBy || '-'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={ct.approvalNote}>{ct.approvalNote || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </Card>
);
};

// --- KidDashboard (Updated to pass completedTasks for pending points calculation) ---
const KidDashboard = ({ kidData, familyId, allTasks, rewards, completedTasks, redeemedRewardsData, showConfirmation }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const kid = kidData;

    const pointsToday = useMemo(() => {
        const todayStart = getStartOfDay(new Date());
        return completedTasks.filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= todayStart).reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pointsThisWeek = useMemo(() => {
        const weekStart = getStartOfWeek(new Date());
        return completedTasks.filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= weekStart).reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pointsThisMonth = useMemo(() => {
        const monthStart = getStartOfMonth(new Date());
        return completedTasks.filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= monthStart).reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pendingPoints = useMemo(() => {
        return completedTasks?.filter(ct => ct.kidId === kid.id && ct.status === 'pending_approval').reduce((sum, ct) => sum + (ct.taskPoints || 0), 0) || 0;
    }, [completedTasks, kid.id]);

    const NavItem = ({ tabName, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center px-3 py-2 sm:px-4 sm:py-3 rounded-lg transition-colors duration-150 text-sm sm:text-base ${activeTab === tabName ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-green-100'}`}
        >
            <Icon size={20} className="mr-2" /> {label}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <KidProfile kid={kid} pointsToday={pointsToday} pointsThisWeek={pointsThisWeek} pointsThisMonth={pointsThisMonth} pendingPoints={pendingPoints} />;
            case 'tasks': return <KidTasksList kid={kid} familyId={familyId} allTasks={allTasks} completedTasks={completedTasks} showConfirmation={showConfirmation} />;
            case 'rewards': return <KidRewardsList kid={kid} familyId={familyId} rewards={rewards} showConfirmation={showConfirmation} />;
            case 'history': return <KidHistory kid={kid} familyId={familyId} completedTasks={completedTasks} redeemedRewards={redeemedRewardsData} />;
            default: return <KidProfile kid={kid} pointsToday={pointsToday} pointsThisWeek={pointsThisWeek} pointsThisMonth={pointsThisMonth} pendingPoints={pendingPoints}/>;
        }
    };

    if (!kid) return <p>Loading kid data...</p>;

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
                <h2 className="text-3xl font-semibold mb-1">Hi, {kid.name}!</h2>
                <p className="text-lg">Ready to earn points?</p>
                <div className="mt-4 text-2xl font-bold">Your Total Points: <span className="bg-white text-green-600 px-3 py-1 rounded-full shadow">{kid.points || 0}</span></div>
            </Card>
            <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-2">
                    <NavItem tabName="profile" icon={User} label="My Profile" />
                    <NavItem tabName="tasks" icon={ClipboardList} label="My Tasks" />
                    <NavItem tabName="rewards" icon={Gift} label="Redeem Rewards" />
                    <NavItem tabName="history" icon={ListChecks} label="My History" />
                </div>
            </nav>
            <div>{renderContent()}</div>
        </div>
    );
};

// --- KidProfile (Updated to show pending and total earned points) ---
const KidProfile = ({ kid, pointsToday, pointsThisWeek, pointsThisMonth, pendingPoints }) => (
    <Card>
        <h3 className="text-2xl font-semibold text-gray-700 mb-4">My Profile</h3>
        <p className="text-lg mb-1"><strong>Name:</strong> {kid.name}</p>
        {kid.email && <p className="text-lg mb-1 flex items-center"><strong>Email:</strong> <Mail size={16} className="mx-1 text-gray-600"/> {kid.email}</p>}

        <div className="text-lg mb-1"><strong>Current Redeemable Points:</strong> <span className="font-bold text-purple-600">{kid.points || 0}</span></div>
        {pendingPoints > 0 && <div className="text-sm mb-1 text-yellow-600 flex items-center"><Info size={14} className="mr-1"/><strong>Pending Approval:</strong> <span className="font-bold ml-1">{pendingPoints}</span></div>}
        <div className="text-lg mb-4"><strong>Total Ever Earned:</strong> <span className="font-bold text-green-600">{kid.totalEarnedPoints || 0}</span></div>

        <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Points Earned (Approved):</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center"><p className="text-sm text-blue-700 font-medium">Today</p><p className="text-2xl font-bold text-blue-600">{pointsToday}</p></div>
            <div className="p-4 bg-green-50 rounded-lg text-center"><p className="text-sm text-green-700 font-medium">This Week</p><p className="text-2xl font-bold text-green-600">{pointsThisWeek}</p></div>
            <div className="p-4 bg-indigo-50 rounded-lg text-center"><p className="text-sm text-indigo-700 font-medium">This Month</p><p className="text-2xl font-bold text-indigo-600">{pointsThisMonth}</p></div>
        </div>
    </Card>
);

// --- KidTasksList (Unchanged from previous logic, only point display updated) ---
const KidTasksList = ({ kid, familyId, allTasks, completedTasks, showConfirmation }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');
    const [taskViewPeriod, setTaskViewPeriod] = useState('today');
    const now = new Date();
    const todayStart = getStartOfDay(now);
    const todayEnd = getEndOfDay(now);
    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfWeek(now);

    const tasksToShow = useMemo(() => {
        return allTasks.filter(task => {
            if (!task.isActive) return false;
            // Check if task is assigned to this kid or unassigned
            if (task.assignedKidId && task.assignedKidId !== kid.id && task.assignedKidId !== null && task.assignedKidId !== '') return false;

            const taskStartDate = task.startDate ? getStartOfDay(new Date(task.startDate)) : todayStart;
            // Don't show tasks that haven't started yet
            if (now < taskStartDate) return false;

            if (task.recurrenceType === 'none') {
                const customDueDate = task.customDueDate ? getEndOfDay(new Date(task.customDueDate)) : null;
                if (!customDueDate) return false; // Non-recurring tasks must have a custom due date

                // Check if already completed or pending for this specific non-recurring task
                const completedOrPending = completedTasks.find(ct =>
                    ct.taskId === task.id &&
                    ct.kidId === kid.id &&
                    (ct.status === 'approved' || ct.status === 'pending_approval') &&
                    ct.taskDueDate?.toDate().getTime() === getStartOfDay(new Date(task.customDueDate)).getTime() // Match by original due date
                );
                // Only show if not completed/pending and due date is within the selected period (today or this week)
                return !completedOrPending && customDueDate >= todayStart && customDueDate <= (taskViewPeriod === 'today' ? todayEnd : weekEnd);

            }

            // For recurring tasks, check the nextDueDate
            const nextDueDate = task.nextDueDate?.toDate ? getStartOfDay(task.nextDueDate.toDate()) : null;
            if (!nextDueDate) return false; // Recurring tasks must have a calculated next due date

            // Check if the next due date falls within the selected period (today or this week)
            const isDueInPeriod = (taskViewPeriod === 'today' && nextDueDate.getTime() === todayStart.getTime()) ||
                                 (taskViewPeriod === 'week' && nextDueDate >= weekStart && nextDueDate <= weekEnd);

            if (!isDueInPeriod) return false;

            // Check if already submitted or approved for this specific next due date
            const submittedOrApprovedForThisDueDate = completedTasks.find(ct =>
                ct.taskId === task.id &&
                ct.kidId === kid.id &&
                ct.taskDueDate?.toDate().getTime() === nextDueDate.getTime() && // Match by the specific due date instance
                (ct.status === 'approved' || ct.status === 'pending_approval')
            );

            return !submittedOrApprovedForThisDueDate;

        }).sort((a,b) =>
            // Sort by next due date (or custom due date for non-recurring)
            (a.nextDueDate?.toMillis() || (a.customDueDate ? new Date(a.customDueDate).getTime() : 0)) -
            (b.nextDueDate?.toMillis() || (b.customDueDate ? new Date(b.customDueDate).getTime() : 0) )
        );
    }, [allTasks, kid.id, completedTasks, taskViewPeriod, todayStart, todayEnd, weekStart, weekEnd, now]);

    const handleCompleteTask = async (task) => {
        // Determine the specific due date instance for this completion
        const taskDueDateForCompletion = task.recurrenceType === 'none'
            ? (task.customDueDate ? Timestamp.fromDate(getStartOfDay(new Date(task.customDueDate))) : Timestamp.fromDate(todayStart)) // Use custom due date for non-recurring
            : task.nextDueDate; // Use the calculated nextDueDate for recurring

        if (!taskDueDateForCompletion) {
            setShowFeedback(`Cannot determine due date for "${task.name}".`);
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 4000);
            return;
        }

        // Prevent duplicate submissions for the same task instance/due date
        const alreadySubmitted = completedTasks.find(ct =>
            ct.taskId === task.id &&
            ct.kidId === kid.id &&
            ct.status === 'pending_approval' &&
            ct.taskDueDate?.toDate().getTime() === taskDueDateForCompletion.toDate().getTime() // Match by the specific due date instance
        );

        if (alreadySubmitted) {
            setShowFeedback(`Already submitted "${task.name}" for this due date.`);
            setFeedbackType('info');
            setTimeout(() => setShowFeedback(''), 4000);
            return;
        }

        try {
            await addDoc(collection(db, getFamilyScopedCollectionPath(familyId, 'completedTasks')), {
                kidId: kid.id,
                kidName: kid.name, // Store kid name for easier history viewing
                taskId: task.id,
                taskName: task.name, // Store task name
                taskPoints: task.points, // Store points at time of submission
                taskDueDate: taskDueDateForCompletion, // Store the specific due date instance
                dateSubmitted: Timestamp.now(),
                status: 'pending_approval' // Initial status
            });
            setShowFeedback(`Task "${task.name}" submitted for approval!`);
            setFeedbackType('success');
        } catch (error) {
            console.error("Error completing task: ", error);
            setShowFeedback('Error submitting task.');
            setFeedbackType('error');
        } finally {
            setTimeout(() => setShowFeedback(''), 3000);
        }
    };

    const [taskToWithdraw, setTaskToWithdraw] = useState(null);
    const confirmWithdrawTask = (completedTaskInstance) => {
        setTaskToWithdraw(completedTaskInstance);
        showConfirmation(
            "Withdraw Task",
            `Are you sure you want to withdraw your submission for "${completedTaskInstance.taskName}"?`,
            () => handleWithdrawTask(completedTaskInstance.id)
        );
    };

    const handleWithdrawTask = async (completedTaskId) => {
        if(!completedTaskId) return;
        try {
            await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'completedTasks'), completedTaskId));
            setShowFeedback("Task submission withdrawn.");
            setFeedbackType('info');
            setTaskToWithdraw(null);
        } catch (error) {
            console.error("Error withdrawing task: ", error);
            setShowFeedback("Failed to withdraw task.");
            setFeedbackType('error');
        } finally {
             setTimeout(() => setShowFeedback(''), 3000);
        }
    };

    const feedbackColor = {
        info: 'bg-blue-100 text-blue-700',
        success: 'bg-green-100 text-green-700',
        error: 'bg-red-100 text-red-700'
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700 mb-2 sm:mb-0">My Tasks</h3>
                 <SelectField
                    value={taskViewPeriod}
                    onChange={e => setTaskViewPeriod(e.target.value)}
                    options={[{value: 'today', label: "Today's Tasks"}, {value: 'week', label: "This Week's Tasks"}]}
                />
            </div>
            {showFeedback && (
                <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>
                    {showFeedback}
                </p>
            )}
            {tasksToShow.length === 0 ? (
                <p className="text-gray-500">No tasks due for this period, or all due tasks are submitted/completed.</p>
            ) : (
                <ul className="space-y-4">
                    {tasksToShow.map(task => {
                        // Determine the specific due date instance to display for this task item
                        const displayDueDate = task.recurrenceType === 'none'
                            ? (task.customDueDate ? new Date(task.customDueDate+'T00:00:00') : null)
                            : task.nextDueDate?.toDate();

                        // Check if this specific task instance (matched by due date) is pending approval
                        const pendingSubmission = completedTasks.find(ct =>
                            ct.taskId === task.id &&
                            ct.kidId === kid.id &&
                            ct.status === 'pending_approval' &&
                            ct.taskDueDate?.toDate().getTime() === (displayDueDate?.getTime()) // Match by the specific due date instance
                        );

                        return (
                            <li key={task.id + (displayDueDate?.getTime() || '')} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <span className="font-semibold text-lg text-gray-800">{task.name}</span>
                                    <div className="flex items-center text-sm text-purple-600 font-semibold">
                                        {task.points >= 1 && task.points <= 5 ? (
                                            <StarIconDisplay count={task.points} />
                                        ) : (
                                            <span>{task.points}</span>
                                        )}
                                        <span className="ml-1">points</span>
                                    </div>
                                    {displayDueDate && <p className="text-xs text-gray-500">Due: {displayDueDate.toLocaleDateString()}</p>}
                                </div>
                                {pendingSubmission ? (
                                     <Button onClick={() => confirmWithdrawTask(pendingSubmission)} className="bg-yellow-500 hover:bg-yellow-600" icon={RefreshCcw}>Withdraw</Button>
                                ) : (
                                     <Button onClick={() => handleCompleteTask(task)} className="bg-blue-500 hover:bg-blue-600" icon={CheckCircle}>I Did This!</Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};

// --- KidRewardsList (Unchanged) ---
const KidRewardsList = ({ kid, familyId, rewards, showConfirmation }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');
    const [rewardToRedeem, setRewardToRedeem] = useState(null);

    const confirmRedeemReward = (reward) => {
        if ((kid.points || 0) < reward.pointCost) {
            setShowFeedback("Not enough points.");
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 3000);
            return;
        }
        setRewardToRedeem(reward);
        showConfirmation(
            "Confirm Redemption",
            `Redeem "${reward.name}" for ${reward.pointCost} points?`,
            handleRedeemReward,
            "Redeem"
        );
    };

    const handleRedeemReward = async () => {
        if(!rewardToRedeem) return;

        // Double check points before committing
        if ((kid.points || 0) < rewardToRedeem.pointCost) {
             setShowFeedback("Not enough points (check again).");
             setFeedbackType('error');
             setTimeout(() => setShowFeedback(''), 3000);
             setRewardToRedeem(null);
             return;
        }

        try {
            const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), kid.id);
            const batch = writeBatch(db);

            // Deduct points
            batch.update(kidRef, {
                points: (kid.points || 0) - rewardToRedeem.pointCost
            });

            // Add redeemed reward entry
            const newRedeemedRewardRef = doc(collection(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards')));
            batch.set(newRedeemedRewardRef, {
                kidId: kid.id,
                kidName: kid.name, // Store kid name
                rewardId: rewardToRedeem.id,
                rewardName: rewardToRedeem.name, // Store reward name
                pointsSpent: rewardToRedeem.pointCost,
                dateRedeemed: Timestamp.now(),
                status: 'pending_fulfillment' // Initial status
            });

            await batch.commit();

            setShowFeedback(`"${rewardToRedeem.name}" redeemed! Awaiting parent fulfillment.`);
            setFeedbackType('success');

        } catch (error) {
            console.error("Error redeeming: ", error);
            setShowFeedback('Error redeeming reward.');
            setFeedbackType('error');
        } finally {
            setRewardToRedeem(null);
            setTimeout(() => setShowFeedback(''), 4000);
        }
    };

    const available = rewards.filter(r => r.isAvailable);

    const fbColor = {
        info: 'bg-blue-100 text-blue-700',
        success: 'bg-green-100 text-green-700',
        error: 'bg-red-100 text-red-700'
    };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Redeem Rewards</h3>
            {showFeedback && (
                <p className={`mb-4 p-3 rounded-md ${fbColor[feedbackType]}`}>
                    {showFeedback}
                </p>
            )}
            {available.length === 0 ? (
                <p className="text-gray-500">No rewards available in this family.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {available.map(r => (
                        <Card key={r.id} className="flex flex-col justify-between items-center text-center border border-yellow-300">
                            <Gift size={48} className="text-yellow-500 mb-3" />
                            <h4 className="font-semibold text-xl text-gray-800 mb-1">{r.name}</h4>
                            <p className="text-lg text-yellow-700 font-bold mb-3">{r.pointCost} points</p>
                            <Button
                                onClick={() => confirmRedeemReward(r)}
                                disabled={(kid.points||0)<r.pointCost}
                                className={`w-full ${(kid.points||0)<r.pointCost ? 'bg-gray-400':'bg-yellow-500 hover:bg-yellow-600'}`}
                                icon={DollarSign}
                            >
                                {(kid.points||0)<r.pointCost?'Not Enough Points':'Redeem'}
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </Card>
    );
};

// --- KidHistory (Unchanged) ---
const KidHistory = ({ kid, familyId, completedTasks, redeemedRewards }) => {
    const [filterPeriod, setFilterPeriod] = useState('all');
    const now = new Date();

    const filterData = (data, dateField) => {
        if (filterPeriod === 'all') return data;
        return data.filter(item => {
            const iDate = item[dateField]?.toDate();
            if (!iDate) return false;
            if (filterPeriod === 'today') return getStartOfDay(iDate).getTime()===getStartOfDay(now).getTime();
            if (filterPeriod === 'week') return iDate>=getStartOfWeek(now) && iDate<=getEndOfWeek(now);
            if (filterPeriod === 'month') return iDate>=getStartOfMonth(now) && iDate<=getEndOfMonth(now);
            return true;
        });
    };

    const kidCT = completedTasks.filter(ct => ct.kidId === kid.id);
    const kidRR = redeemedRewards.filter(rr => rr.kidId === kid.id);

    const fCompleted = filterData(kidCT, 'dateSubmitted').sort((a,b)=>b.dateSubmitted.toMillis()-a.dateSubmitted.toMillis());
    const fRedeemed = filterData(kidRR, 'dateRedeemed').sort((a,b)=>b.dateRedeemed.toMillis()-a.dateRedeemed.toMillis());

    const getStatusClass = (status) => {
        if (status === 'approved') return 'text-green-600';
        if (status === 'rejected') return 'text-red-600';
        if (status === 'pending_approval') return 'text-yellow-600';
        if (status === 'pending_fulfillment') return 'text-blue-600';
        if (status === 'fulfilled') return 'text-purple-600';
        if (status === 'cancelled_by_parent') return 'text-pink-600 line-through';
        return 'text-gray-600';
    };

    return (
        <div className="space-y-8">
             <div className="flex justify-end mb-0 -mt-4">
                 <SelectField
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    options={[{value:'all',label:'All Time'},{value:'today',label:'Today'},{value:'week',label:'This Week'},{value:'month',label:'This Month'}]}
                />
            </div>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Task History</h3>
                {fCompleted.length === 0 ? (
                    <p className="text-gray-500">No tasks submitted for this period.</p>
                ) : (
                    <ul className="space-y-3">
                        {fCompleted.map(ct => (
                            <li key={ct.id} className={`p-3 rounded-lg shadow-sm ${ct.status === 'rejected' ? 'bg-red-50' : (ct.status === 'approved' ? 'bg-green-50' : 'bg-yellow-50')}`}>
                                <p className="font-medium text-gray-800">{ct.taskName}</p>
                                <p className="text-sm text-gray-500">Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()}</p>
                                <p className="text-sm text-gray-500">Status: <span className={`font-semibold ${getStatusClass(ct.status)}`}>{ct.status?.replace(/_/g, ' ') || 'Pending'}</span>{ct.status==='approved' && ` (+${ct.pointsAwarded || 0} pts)`}</p>
                                {ct.approvalNote && <p className="text-xs text-gray-600 mt-1 italic">Parent Note: {ct.approvalNote}</p>}
                                {ct.processedBy && <p className="text-xs text-gray-500 mt-1">Processed by: {ct.processedBy}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Redeemed Rewards</h3>
                 {fRedeemed.length === 0 ? (
                    <p className="text-gray-500">No rewards redeemed for this period.</p>
                ) : (
                    <ul className="space-y-3">
                        {fRedeemed.map(rr => (
                            <li key={rr.id} className={`p-3 rounded-lg shadow-sm ${rr.status === 'cancelled_by_parent' ? 'bg-pink-50' : (rr.status === 'fulfilled' ? 'bg-purple-50' : (rr.status === 'pending_fulfillment' ? 'bg-blue-50' : 'bg-gray-50')) }`}>
                                <p className="font-medium text-gray-800">{rr.rewardName}</p>
                                <p className="text-sm text-gray-500">Requested: {rr.dateRedeemed?.toDate().toLocaleDateString()} for {rr.pointsSpent} points</p>
                                <p className="text-sm text-gray-500">Status: <span className={`font-semibold ${getStatusClass(rr.status)}`}>{rr.status?.replace(/_/g, ' ') || 'Unknown'}</span></p>
                                {rr.dateFulfilled && <p className="text-xs text-gray-500">Fulfilled: {rr.dateFulfilled.toDate().toLocaleDateString()}</p>}
                                {rr.dateCancelled && <p className="text-xs text-gray-500">Cancelled: {rr.dateCancelled.toDate().toLocaleDateString()}</p>}
                                {rr.cancellationNote && <p className="text-xs text-gray-600 mt-1 italic">Parent Note: {rr.cancellationNote}</p>}
                                {(rr.fulfilledBy || rr.cancelledBy) && <p className="text-xs text-gray-500 mt-1">Processed by: {rr.fulfilledBy || rr.cancelledBy}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default App;
