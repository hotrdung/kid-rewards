// src/hooks/useAppData.js
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { familiesCollectionPath, getFamilyScopedCollectionPath } from '../utils/firestorePaths';

export const useAppData = (loggedInUser, isAuthReady, firebaseAuthUser) => {
    const [allFamiliesForSA, setAllFamiliesForSA] = useState([]);
    const [kids, setKids] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [redeemedRewardsData, setRedeemedRewardsData] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState('');

    const loggedInUserUid = loggedInUser?.uid;
    const loggedInUserIsSA = loggedInUser?.isSA;
    const activeFamilyId = loggedInUser?.activeFamilyRole?.familyId;

    useEffect(() => {
        setDataError('');
        if (!isAuthReady || !firebaseAuthUser) {
            setDataLoading(false);
            return;
        }

        let unsubscribes = [];
        setDataLoading(true);

        if (loggedInUserIsSA && !activeFamilyId) { // SA in Admin Dashboard view
            const familiesQuery = query(collection(db, familiesCollectionPath));
            unsubscribes.push(onSnapshot(familiesQuery, (snapshot) => {
                setAllFamiliesForSA(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }, err => {
                console.error("Error fetching families for SA:", err);
                setDataError(`Failed to load families for admin. ${err.message}`);
            }));
            // Clear family-specific data when SA is in admin view
            setKids([]); setTasks([]); setRewards([]); setCompletedTasks([]); setRedeemedRewardsData([]);
        } else if (activeFamilyId) { // User in Family View
            const collectionsToFetch = [
                { pathGetter: getFamilyScopedCollectionPath, name: 'kids', setter: setKids },
                { pathGetter: getFamilyScopedCollectionPath, name: 'tasks', setter: setTasks },
                { pathGetter: getFamilyScopedCollectionPath, name: 'rewards', setter: setRewards },
                { pathGetter: getFamilyScopedCollectionPath, name: 'completedTasks', setter: setCompletedTasks },
                { pathGetter: getFamilyScopedCollectionPath, name: 'redeemedRewards', setter: setRedeemedRewardsData },
            ];
            collectionsToFetch.forEach(col => {
                const q = query(collection(db, col.pathGetter(activeFamilyId, col.name)));
                unsubscribes.push(onSnapshot(q, (snapshot) => {
                    col.setter(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => {
                    console.error(`Error fetching ${col.name} for family ${activeFamilyId}:`, err);
                    setDataError(`Failed to load ${col.name}.`);
                }));
            });
             // If SA switches to a family view, clear allFamiliesForSA if not needed, or keep if admin might switch back without full reload
            // setAllFamiliesForSA([]); // Optional: clear if not needed in family view
        } else if (loggedInUserUid && !activeFamilyId && !loggedInUserIsSA) { // Logged in, but no active family and not SA
            setKids([]); setTasks([]); setRewards([]); setCompletedTasks([]); setRedeemedRewardsData([]);
        } else if (!loggedInUser) { // No loggedInUser profile (e.g., still anonymous or error)
             setKids([]); setTasks([]); setRewards([]); setCompletedTasks([]); setRedeemedRewardsData([]);
        }


        setDataLoading(false);
        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [isAuthReady, firebaseAuthUser, loggedInUserUid, loggedInUserIsSA, activeFamilyId, loggedInUser]);


    return {
        allFamiliesForSA, setAllFamiliesForSA, // Allow App.js to update this if needed for family name sync
        kids, tasks, rewards, completedTasks, redeemedRewardsData,
        dataLoading, dataError, setDataError
    };
};
