// src/components/admin/ManageFamilyParents.js
import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { usersCollectionPath } from '../../utils/firestorePaths';
import { UserPlus } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import SelectField from '../common/SelectField';
import InputField from '../common/InputField';

const ManageFamilyParents = ({ families, showConfirmation, currentUser }) => {
    const [selectedFamilyId, setSelectedFamilyId] = useState('');
    const [parentEmailToAdd, setParentEmailToAdd] = useState('');
    const [formError, setFormError] = useState('');
    const [feedback, setFeedback] = useState('');

    const familyOptions = families.map(f => ({ value: f.id, label: f.familyName }));

    const handleAddParentToFamily = async () => {
        if (!selectedFamilyId || !parentEmailToAdd.trim()) {
            setFormError("Please select a family and enter the parent's email.");
            return;
        }
        setFormError('');
        setFeedback('');
        try {
            const usersQuery = query(collection(db, usersCollectionPath), where("email", "==", parentEmailToAdd.trim().toLowerCase()));
            const querySnapshot = await getDocs(usersQuery);
            if (querySnapshot.empty) {
                setFormError(`User with email ${parentEmailToAdd} not found. They need to log in to the app at least once.`);
                return;
            }
            const parentUserDoc = querySnapshot.docs[0];
            const parentUserId = parentUserDoc.id;
            const parentUserData = parentUserDoc.data();

            const existingRole = parentUserData.familyRoles?.find(r => r.familyId === selectedFamilyId && r.role === 'parent');
            if (existingRole) {
                setFeedback(`${parentEmailToAdd} is already a parent in this family.`);
                return;
            }

            const familyDoc = families.find(f => f.id === selectedFamilyId);
            const newRole = { familyId: selectedFamilyId, role: 'parent', familyName: familyDoc?.familyName || "Unknown Family" };

            showConfirmation(
                "Add Parent to Family",
                `Are you sure you want to add ${parentEmailToAdd} as a parent to family "${familyDoc?.familyName}"?`,
                async () => {
                    await updateDoc(doc(db, usersCollectionPath, parentUserId), { familyRoles: arrayUnion(newRole) });
                    setFeedback(`${parentEmailToAdd} added as a parent to ${familyDoc?.familyName}.`);
                    setParentEmailToAdd('');
                }
            );
        } catch (e) {
            console.error("Error adding parent to family:", e);
            setFormError("Failed to add parent. " + e.message);
        }
    };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Assign Parent to Family</h3>
            {formError && <p className="text-red-500 text-sm mb-3 p-2 bg-red-100 rounded">{formError}</p>}
            {feedback && <p className="text-green-500 text-sm mb-3 p-2 bg-green-100 rounded">{feedback}</p>}
            <SelectField
                label="Select Family"
                value={selectedFamilyId}
                onChange={e => setSelectedFamilyId(e.target.value)}
                options={familyOptions}
                placeholder="-- Choose a Family --"
            />
            <InputField
                label="Parent's Email Address"
                type="email" value={parentEmailToAdd}
                onChange={e => setParentEmailToAdd(e.target.value)}
                placeholder="parent@example.com"
            />
            <Button onClick={handleAddParentToFamily} className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-4 py-2" icon={UserPlus} disabled={!selectedFamilyId || !parentEmailToAdd} title="Add Parent">
                <span className="hidden sm:inline">Add Parent</span>
            </Button>
            {selectedFamilyId && (
                <div className="mt-6">
                    <h4 className="text-lg font-medium text-gray-600">Current Parents in {families.find(f => f.id === selectedFamilyId)?.familyName || ''}:</h4>
                    <p className="text-sm text-gray-500">(Displaying this list requires querying the 'users' collection based on familyRoles - TBD)</p>
                </div>
            )}
        </Card>
    );
};

export default ManageFamilyParents;