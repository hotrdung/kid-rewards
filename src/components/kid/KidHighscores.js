// src/components/kid/KidHighscores.js
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { familiesCollectionPath, getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { Star } from 'lucide-react';
import Card from '../common/Card';

const KidHighscores = ({ currentKid, currentFamilyId }) => {
    const [scores, setScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setErrorMsg] = useState('');
    const [familyScope, setFamilyScope] = useState(null);
    const [familyHighscoreGroupId, setFamilyHighscoreGroupId] = useState(null);

    useEffect(() => {
        const fetchFamilyScope = async () => {
            setIsLoading(true); setErrorMsg('');
            try {
                const familyDocRef = doc(db, familiesCollectionPath, currentFamilyId);
                const familyDocSnap = await getDoc(familyDocRef);
                if (familyDocSnap.exists()) {
                    const familyData = familyDocSnap.data();
                    setFamilyScope(familyData.highscoreScope || 'disabled');
                    setFamilyHighscoreGroupId(familyData.highscoreGroupId || null);
                } else { setErrorMsg("Your family's settings could not be loaded."); setFamilyScope('disabled'); }
            } catch (e) { console.error("Error fetching family scope:", e); setErrorMsg("Error loading highscore settings."); setFamilyScope('disabled'); }
        };
        fetchFamilyScope();
    }, [currentFamilyId]);

    useEffect(() => {
        if (!familyScope) { setIsLoading(familyScope === null && !error); return; }

        const fetchScores = async () => {
            setIsLoading(true); setErrorMsg(''); setScores([]);
            try {
                let fetchedKids = [];
                if (familyScope === 'internal') {
                    const kidsQuery = query(collection(db, getFamilyScopedCollectionPath(currentFamilyId, 'kids')));
                    const kidsSnap = await getDocs(kidsQuery);
                    const familyDoc = await getDoc(doc(db, familiesCollectionPath, currentFamilyId));
                    const familyName = familyDoc.exists() ? familyDoc.data().familyName : "Your Family";
                    kidsSnap.forEach(kidDoc => {
                        const kidData = kidDoc.data();
                        fetchedKids.push({ id: kidDoc.id, name: kidData.name, points: kidData.totalEarnedPoints || 0, familyName: familyName, isCurrentUser: kidDoc.id === currentKid.id });
                    });
                } else if (familyScope === 'group' && familyHighscoreGroupId) {
                    const participatingFamiliesQuery = query(collection(db, familiesCollectionPath), where("highscoreScope", "==", "group"), where("highscoreGroupId", "==", familyHighscoreGroupId));
                    const familiesSnap = await getDocs(participatingFamiliesQuery);
                    const kidFetchPromises = familiesSnap.docs.map(familyDoc => {
                        const familyData = familyDoc.data();
                        const kidsInFamilyQuery = query(collection(db, getFamilyScopedCollectionPath(familyDoc.id, 'kids')));
                        return getDocs(kidsInFamilyQuery).then(kidsSnap => kidsSnap.docs.map(kidDoc => {
                            const kidData = kidDoc.data();
                            return { id: kidDoc.id, authUid: kidData.authUid, name: kidData.name, points: kidData.totalEarnedPoints || 0, familyName: familyData.familyName, isCurrentUser: (kidData.authUid === currentKid.authUid || kidDoc.id === currentKid.id) && familyDoc.id === currentFamilyId };
                        }));
                    });
                    const results = await Promise.all(kidFetchPromises);
                    fetchedKids = results.flat();
                }
                fetchedKids.sort((a, b) => b.points - a.points);
                setScores(fetchedKids);
            } catch (e) { console.error("Error fetching highscores:", e); setErrorMsg("Could not load highscores. " + e.message); }
            finally { setIsLoading(false); }
        };

        if (familyScope && familyScope !== 'disabled') fetchScores();
        else setIsLoading(false);
    }, [familyScope, familyHighscoreGroupId, currentFamilyId, currentKid.id, currentKid.authUid]);

    if (isLoading) {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-4">Highscores</h3><p>Loading highscores...</p></Card>;
    }
    if (error) {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-4">Highscores</h3><p className="text-red-500">{error}</p></Card>;
    }
    if (familyScope === 'disabled') {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-4">Highscores</h3><p className="text-gray-600">Highscores are not enabled for your family.</p></Card>;
    }
    if (scores.length === 0 && (familyScope === 'internal' || familyScope === 'group')) {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-4">Highscores</h3><p className="text-gray-600">No scores to display yet. Keep earning points!</p></Card>;
    }

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Highscores</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            {(familyScope === 'group') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family</th>}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points Earned</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {scores.map((score, index) => (
                            <tr key={score.id + score.familyName} className={score.isCurrentUser ? 'bg-green-100 font-semibold' : ''}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{score.name} {score.isCurrentUser && <Star size={14} className="inline ml-1 text-yellow-500 fill-current" />}</td>
                                {(familyScope === 'group') && <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{score.familyName}</td>}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{score.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default KidHighscores;