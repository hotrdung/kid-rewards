// src/components/parent/ManageRewards.js
import React, { useState, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { PlusCircle, Edit3, Trash2, Copy, EyeOff, Eye as EyeIcon, ChevronsUpDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField';

const ManageRewards = ({ familyId, rewardsInFamily, allRedeemedRewardInstances, showConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rewardName, setRewardName] = useState('');
    const [rewardCost, setRewardCost] = useState('');
    const [rewardIsAvailable, setRewardIsAvailable] = useState(true);
    const [formError, setFormError] = useState('');
    const [editingReward, setEditingReward] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'pointCost', direction: 'descending' });
    const [showUnusedRewards, setShowUnusedRewards] = useState(true);

    const handleSaveOrUpdateReward = async () => {
        setFormError('');
        if (!rewardName.trim() || !rewardCost || isNaN(parseInt(rewardCost)) || parseInt(rewardCost) <= 0) {
            setFormError("Reward name and a positive point cost are required."); return;
        }
        const rewardsPath = getFamilyScopedCollectionPath(familyId, 'rewards');
        try {
            const rewardData = { name: rewardName.trim(), pointCost: parseInt(rewardCost), isAvailable: rewardIsAvailable };
            if (editingReward) {
                rewardData.updatedAt = Timestamp.now();
                await updateDoc(doc(db, rewardsPath, editingReward.id), rewardData);
            } else {
                rewardData.createdAt = Timestamp.now();
                await addDoc(collection(db, rewardsPath), rewardData);
            }
            setRewardName(''); setRewardCost(''); setEditingReward(null); setIsModalOpen(false); setRewardIsAvailable(true);
        } catch (error) {
            console.error("Error adding/updating reward: ", error); setFormError("Failed to save reward.");
        }
    };

    const openAddModal = () => {
        setEditingReward(null); setRewardName(''); setRewardCost(''); setRewardIsAvailable(true); setFormError(''); setIsModalOpen(true);
    };

    const openEditModal = (reward) => {
        setEditingReward(reward); setRewardName(reward.name); setRewardCost(reward.pointCost.toString()); setRewardIsAvailable(reward.isAvailable !== false); setFormError(''); setIsModalOpen(true);
    };

    const handleCloneReward = (rewardToClone) => {
        setEditingReward(null); setRewardName(`Copy of ${rewardToClone.name}`); setRewardCost(rewardToClone.pointCost.toString()); setRewardIsAvailable(rewardToClone.isAvailable !== false); setFormError(''); setIsModalOpen(true);
    };

    const confirmDeleteReward = (reward) => {
        showConfirmation("Confirm Deletion", `Are you sure you want to delete reward "${reward.name}"?`, () => handleDeleteReward(reward.id));
    };

    const handleDeleteReward = async (rewardId) => {
        if (!rewardId) return;
        try {
            await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'rewards'), rewardId));
        } catch (error) {
            console.error("Error deleting reward: ", error);
        }
    };

    const sortedRewards = useMemo(() => {
        let filteredRewards = rewardsInFamily.filter(rewardDef => {
            const hasBeenUsed = allRedeemedRewardInstances.some(rr => rr.rewardId === rewardDef.id && (rr.status === 'pending_fulfillment' || rr.status === 'fulfilled'));
            return showUnusedRewards ? !hasBeenUsed : hasBeenUsed;
        });
        if (sortConfig.key) {
            filteredRewards.sort((a, b) => {
                let valA = a[sortConfig.key], valB = b[sortConfig.key];
                if (sortConfig.key === 'createdAt' && valA?.toDate && valB?.toDate) { valA = valA.toMillis(); valB = valB.toMillis(); }
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filteredRewards;
    }, [rewardsInFamily, allRedeemedRewardInstances, sortConfig, showUnusedRewards]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        else if (sortConfig.key === key && sortConfig.direction === 'descending') direction = 'ascending';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown size={16} className="ml-1 opacity-40" />;
        return sortConfig.direction === 'ascending' ? <ArrowUpCircle size={16} className="ml-1" /> : <ArrowDownCircle size={16} className="ml-1" />;
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700 capitalize">{showUnusedRewards ? "Available Rewards" : "Redeemed/Fulfilled Rewards"}</h3>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Button onClick={() => setShowUnusedRewards(!showUnusedRewards)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={showUnusedRewards ? EyeIcon : EyeOff}>{showUnusedRewards ? "Show Used" : "Show Unused"}</Button>
                    <Button onClick={() => requestSort('name')} className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Name {getSortIcon('name')}</Button>
                    <Button onClick={() => requestSort('pointCost')} className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Points {getSortIcon('pointCost')}</Button>
                    <Button onClick={openAddModal} className="bg-yellow-500 hover:bg-yellow-600 text-xs sm:text-sm px-2 sm:px-3 py-1.5" icon={PlusCircle} title="Add Reward"><span className="hidden sm:inline">Add Reward</span></Button>
                </div>
            </div>
            {sortedRewards.length === 0 ? <p className="text-gray-500">{showUnusedRewards ? "No unused reward templates." : "No used reward templates."}</p> : (
                <ul className="space-y-3">
                    {sortedRewards.map(reward => (
                        <li key={reward.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{reward.name}</span>
                                {!reward.isAvailable && <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">Inactive</span>}
                                <span className="ml-4 text-sm text-yellow-700 font-semibold">{reward.pointCost} points</span>
                            </div>
                            <div className="flex space-x-1 sm:space-x-2 mt-2 sm:mt-0">
                                <Button onClick={() => handleCloneReward(reward)} className="bg-sky-500 hover:bg-sky-600 px-2 py-1 text-xs sm:text-sm" icon={Copy} title="Clone Reward"><span className="hidden sm:inline">Clone</span></Button>
                                <Button onClick={() => openEditModal(reward)} className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-1 text-sm" icon={Edit3} title="Edit Reward"><span className="hidden sm:inline">Edit</span></Button>
                                <Button onClick={() => confirmDeleteReward(reward)} className="bg-red-500 hover:bg-red-600 px-2 sm:px-3 py-1 text-sm" icon={Trash2} title="Delete Reward"><span className="hidden sm:inline">Delete</span></Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setFormError(''); setEditingReward(null); setRewardIsAvailable(true); }} title={editingReward ? "Edit Reward" : "Add New Reward"}>
                {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
                <InputField label="Reward Name" value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="e.g., Extra screen time" required />
                <InputField label="Point Cost" type="number" value={rewardCost} onChange={e => setRewardCost(e.target.value)} placeholder="e.g., 50" required min="1" />
                <div className="mb-4">
                    <label className="flex items-center">
                        <input type="checkbox" checked={rewardIsAvailable} onChange={e => setRewardIsAvailable(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <span className="text-sm font-medium text-gray-700">Available for Redemption</span>
                    </label>
                </div>
                <Button onClick={handleSaveOrUpdateReward} className="w-full bg-yellow-500 hover:bg-yellow-600">{editingReward ? "Save Changes" : "Add Reward"}</Button>
            </Modal>
        </Card>
    );
};

export default ManageRewards;