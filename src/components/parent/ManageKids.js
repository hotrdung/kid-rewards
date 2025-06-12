// src/components/parent/ManageKids.js
import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, arrayUnion, getDoc, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath, usersCollectionPath } from '../../utils/firestorePaths';
import { PlusCircle, Edit3, Trash2, Mail } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField';

const ManageKids = ({ parentUser, familyId, kidsInFamily, completedTasks, showConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [kidName, setKidName] = useState('');
    const [kidEmail, setKidEmail] = useState('');
    const [editingKid, setEditingKid] = useState(null);
    const [formError, setFormError] = useState('');

    const openAddModal = () => {
        setEditingKid(null); setKidName(''); setKidEmail(''); setFormError(''); setIsModalOpen(true);
    };
    const openEditModal = (kid) => {
        setEditingKid(kid); setKidName(kid.name); setKidEmail(kid.email || ''); setFormError(''); setIsModalOpen(true);
    };

    const handleSaveKid = async () => {
        if (!kidName.trim()) { setFormError('Kid name is required.'); return; }
        if (kidEmail.trim() && !/\S+@\S+\.\S+/.test(kidEmail.trim())) {
            setFormError('Please enter a valid email address or leave it blank.'); return;
        }
        setFormError('');
        const kidData = {
            name: kidName.trim(),
            email: kidEmail.trim().toLowerCase() || null,
            points: editingKid ? (editingKid.points || 0) : 0,
            totalEarnedPoints: editingKid ? (editingKid.totalEarnedPoints || 0) : 0,
            familyId: familyId,
        };
        try {
            const kidsPath = getFamilyScopedCollectionPath(familyId, 'kids');
            if (editingKid) {
                await updateDoc(doc(db, kidsPath, editingKid.id), kidData);
            } else {
                kidData.createdAt = Timestamp.now();
                kidData.addedByParentUid = parentUser.uid;
                const newKidRef = await addDoc(collection(db, kidsPath), kidData);
                // If email is provided, try to link to an existing user or prepare for future linking
                if (kidData.email) {
                    const userQuery = query(collection(db, usersCollectionPath), where("email", "==", kidData.email));
                    const userSnap = await getDocs(userQuery);
                    let kidAuthUid;
                    if (!userSnap.empty) {
                        kidAuthUid = userSnap.docs[0].id;
                        const kidUserDocRef = doc(db, usersCollectionPath, kidAuthUid);
                        const kidUserDoc = await getDoc(kidUserDocRef);
                        // Add kid role to user if not already present for this family
                        if (kidUserDoc.exists() && !kidUserDoc.data().familyRoles?.find(fr => fr.familyId === familyId && fr.role === 'kid')) {
                            await updateDoc(kidUserDocRef, {
                                familyRoles: arrayUnion({
                                    familyId: familyId,
                                    role: 'kid',
                                    familyName: parentUser.activeFamilyRole.familyName // Get family name from parent's active role
                                })
                            });
                        }
                    }
                    // Update the kid document with the authUid if found
                    if (kidAuthUid) {
                        await updateDoc(doc(db, kidsPath, newKidRef.id), { authUid: kidAuthUid });
                    }
                }
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving kid: ", error);
            setFormError('Failed to save kid. ' + error.message);
        }
    };

    const confirmDeleteKid = (kid) => {
        showConfirmation(
            "Confirm Deletion",
            `Are you sure you want to delete kid "${kid.name}" from your family?`,
            () => handleDeleteKid(kid.id)
        );
    };

    const handleDeleteKid = async (kidId) => {
        if (!kidId) return;
        try {
            await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), kidId));
            // Consider also removing the 'kid' role from the user's document if they were linked
        } catch (error) {
            console.error("Error deleting kid: ", error);
        }
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700">
                    Kids in Family: {parentUser.activeFamilyRole.familyName}
                </h3>
                <Button onClick={openAddModal} className="bg-green-500 hover:bg-green-600 text-sm px-2 sm:px-3 py-1.5" icon={PlusCircle} title="Add Kid">
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
                                    {kid.email && <p className="text-xs text-gray-500 mt-1 flex items-center"><Mail size={12} className="mr-1" /> {kid.email}</p>}
                                    {kid.authUid && <p className="text-xs text-gray-400 mt-1">Linked</p>}
                                </div>
                                <div className="flex space-x-2 mt-2 sm:mt-0">
                                    <Button onClick={() => openEditModal(kid)} className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-1 text-sm" icon={Edit3} title="Edit Kid"><span className="hidden sm:inline">Edit</span></Button>
                                    <Button onClick={() => confirmDeleteKid(kid)} className="bg-red-500 hover:bg-red-600 px-2 sm:px-3 py-1 text-sm" icon={Trash2} title="Delete Kid"><span className="hidden sm:inline">Delete</span></Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingKid ? "Edit Kid" : "Add New Kid"}>
                {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
                <InputField label="Kid's Name" value={kidName} onChange={e => setKidName(e.target.value)} placeholder="e.g., Alex" required />
                <InputField label="Kid's Email (Optional, for Google Login)" type="email" value={kidEmail} onChange={e => setKidEmail(e.target.value)} placeholder="e.g., alex@example.com" />
                <p className="text-xs text-gray-500 mb-3">If email is provided, the kid can log in using Google. They need to log in once for the system to link their account.</p>
                <Button onClick={handleSaveKid} className="w-full bg-green-500 hover:bg-green-600">{editingKid ? "Save Changes" : "Add Kid"}</Button>
            </Modal>
        </Card>
    );
};

export default ManageKids;