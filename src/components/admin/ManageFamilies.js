// src/components/admin/ManageFamilies.js
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { familiesCollectionPath, highscoreGroupsCollectionPath } from '../../utils/firestorePaths';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField';
import SelectField from '../common/SelectField';

const ManageFamilies = ({ families, showConfirmation, currentUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const initialFamilyFormState = {
        familyName: '',
        highscoreScope: 'disabled', // 'disabled', 'internal', 'group'
        highscoreGroupId: '',
    };
    const [familyFormData, setFamilyFormData] = useState(initialFamilyFormState);
    const [editingFamily, setEditingFamily] = useState(null);
    const [formError, setFormError] = useState('');
    const [highscoreGroups, setHighscoreGroups] = useState([]);

    useEffect(() => {
        const q = query(collection(db, highscoreGroupsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHighscoreGroups(snapshot.docs.map(d => ({ value: d.id, label: d.data().name })));
        }, (error) => {
            console.error("Error fetching highscore groups for family management:", error);
        });
        return () => unsubscribe();
    }, []);

    const highscoreScopeOptions = [
        { value: 'disabled', label: 'Disabled - No highscores' },
        { value: 'internal', label: 'Family Only - Kids see scores within their own family' },
        { value: 'group', label: 'Assigned Group - Kids see scores from families in the same group' },
    ];

    const openAddModal = () => {
        setEditingFamily(null);
        setFamilyFormData(initialFamilyFormState);
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (family) => {
        setEditingFamily(family);
        setFamilyFormData({
            familyName: family.familyName,
            highscoreScope: family.highscoreScope || 'disabled',
            highscoreGroupId: family.highscoreGroupId || '',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleFamilyFormChange = (e) => {
        const { name, value } = e.target;
        setFamilyFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveFamily = async () => {
        if (!familyFormData.familyName.trim()) {
            setFormError('Family name is required.');
            return;
        }
        if (familyFormData.highscoreScope === 'group' && !familyFormData.highscoreGroupId) {
            setFormError('Please select a highscore group if "Assigned Group" visibility is chosen.');
            return;
        }
        setFormError('');

        const familyData = {
            familyName: familyFormData.familyName.trim(),
            highscoreScope: familyFormData.highscoreScope,
            highscoreGroupId: familyFormData.highscoreScope === 'group' ? familyFormData.highscoreGroupId : null,
            updatedAt: Timestamp.now(),
            updatedBy: currentUser.uid,
        };

        try {
            if (editingFamily) {
                await updateDoc(doc(db, familiesCollectionPath, editingFamily.id), familyData);
            } else {
                familyData.createdAt = Timestamp.now();
                familyData.createdBy = currentUser.uid;
                await addDoc(collection(db, familiesCollectionPath), familyData);
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error("Error saving family:", e);
            setFormError("Failed to save family.");
        }
    };

    const confirmDeleteFamily = (family) => {
        showConfirmation(
            "Delete Family",
            `Are you sure you want to delete the family "${family.familyName}"? This will delete ALL associated data (kids, tasks, rewards, history) and cannot be undone. THIS IS A PLACEHOLDER - FULL DATA DELETION REQUIRES SERVER-SIDE LOGIC.`,
            async () => {
                console.warn("Attempting to delete family doc. Cascading delete of subcollections needs server-side implementation.");
                try {
                    await deleteDoc(doc(db, familiesCollectionPath, family.id));
                } catch (e) {
                    console.error("Error deleting family doc:", e);
                }
            }
        );
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700 flex-grow">Manage Families</h3>
                <Button onClick={openAddModal} className="bg-green-500 hover:bg-green-600 text-xs sm:text-sm px-2 sm:px-3 py-1.5" icon={PlusCircle} title="Add Family">
                    <span className="hidden sm:inline">Add Family</span>
                </Button>
            </div>
            {families.length === 0 ? <p className="text-gray-500">No families created yet.</p> : (
                <ul className="space-y-3">
                    {families.map(fam => (
                        <li key={fam.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{fam.familyName}</span>
                                <p className="text-xs text-gray-500 mt-0.5">ID: {fam.id}</p>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    Highscores: <span className="font-medium">{highscoreScopeOptions.find(opt => opt.value === (fam.highscoreScope || 'disabled'))?.label || 'Disabled'}</span>
                                    {fam.highscoreScope === 'group' && fam.highscoreGroupId && (<span className="ml-1 text-blue-600">({highscoreGroups.find(g => g.value === fam.highscoreGroupId)?.label || 'Unknown Group'})</span>)}
                                </div>
                            </div>
                            <div className="flex space-x-2 mt-2 sm:mt-0">
                                <Button onClick={() => openEditModal(fam)} icon={Edit3} className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-1 text-sm" title="Edit Family"><span className="hidden sm:inline">Edit</span></Button>
                                <Button onClick={() => confirmDeleteFamily(fam)} icon={Trash2} className="bg-red-500 hover:bg-red-600 px-2 sm:px-3 py-1 text-sm" title="Delete Family"><span className="hidden sm:inline">Delete</span></Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFamily ? "Edit Family" : "Add New Family"}>
                {formError && <p className="text-red-500 text-sm mb-2">{formError}</p>}
                <InputField label="Family Name" name="familyName" value={familyFormData.familyName} onChange={handleFamilyFormChange} required />
                <SelectField label="Highscore Visibility" name="highscoreScope" value={familyFormData.highscoreScope} onChange={handleFamilyFormChange} options={highscoreScopeOptions} />
                {familyFormData.highscoreScope === 'group' && (
                    <SelectField label="Select Highscore Group" name="highscoreGroupId" value={familyFormData.highscoreGroupId} onChange={handleFamilyFormChange} options={highscoreGroups} placeholder="-- Select a Group --" required />
                )}
                <Button onClick={handleSaveFamily} className="w-full bg-green-500 hover:bg-green-600">{editingFamily ? "Save Changes" : "Create Family"}</Button>
            </Modal>
        </Card>
    );
};

export default ManageFamilies;