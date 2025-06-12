// src/components/admin/ManageHighscoreGroups.js
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { highscoreGroupsCollectionPath } from '../../utils/firestorePaths';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField';

const ManageHighscoreGroups = ({ showConfirmation, currentUser }) => {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const q = query(collection(db, highscoreGroupsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching highscore groups:", error);
            setFormError("Failed to load highscore groups.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const openAddModal = () => {
        setEditingGroup(null); setGroupName(''); setFormError(''); setIsModalOpen(true);
    };
    const openEditModal = (group) => {
        setEditingGroup(group); setGroupName(group.name); setFormError(''); setIsModalOpen(true);
    };

    const handleSaveGroup = async () => {
        if (!groupName.trim()) { setFormError('Group name is required.'); return; }
        setFormError('');
        const groupData = {
            name: groupName.trim(),
            updatedAt: Timestamp.now(),
            updatedBy: currentUser.uid,
        };
        try {
            if (editingGroup) {
                await updateDoc(doc(db, highscoreGroupsCollectionPath, editingGroup.id), groupData);
            } else {
                groupData.createdAt = Timestamp.now();
                groupData.createdBy = currentUser.uid;
                await addDoc(collection(db, highscoreGroupsCollectionPath), groupData);
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error("Error saving highscore group:", e);
            setFormError("Failed to save group.");
        }
    };

    const confirmDeleteGroup = (group) => {
        showConfirmation(
            "Delete Highscore Group",
            `Are you sure you want to delete the group "${group.name}"? Families assigned to this group will need to be reassigned.`,
            async () => {
                try {
                    await deleteDoc(doc(db, highscoreGroupsCollectionPath, group.id));
                    // Note: This doesn't automatically unassign families. Admin needs to manage that.
                } catch (e) { console.error("Error deleting highscore group:", e); }
            }
        );
    };

    if (isLoading) return <Card><p>Loading highscore groups...</p></Card>;

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Manage Highscore Groups</h3>
                <Button onClick={openAddModal} icon={PlusCircle} className="bg-green-500 hover:bg-green-600">Add Group</Button>
            </div>
            {groups.length === 0 ? <p className="text-gray-500">No highscore groups created yet.</p> : (
                <ul className="space-y-3">
                    {groups.map(g => (
                        <li key={g.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-800">{g.name}</span>
                            <div className="space-x-2">
                                <Button onClick={() => openEditModal(g)} icon={Edit3} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm">Edit</Button>
                                <Button onClick={() => confirmDeleteGroup(g)} icon={Trash2} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm">Delete</Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingGroup ? "Edit Group" : "Add New Group"}>
                {formError && <p className="text-red-500 text-sm mb-2">{formError}</p>}
                <InputField label="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} required />
                <Button onClick={handleSaveGroup} className="w-full bg-green-500 hover:bg-green-600">{editingGroup ? "Save Changes" : "Create Group"}</Button>
            </Modal>
        </Card>
    );
};

export default ManageHighscoreGroups;