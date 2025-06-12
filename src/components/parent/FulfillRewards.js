// src/components/parent/FulfillRewards.js
import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { formatShortDate } from '../../utils/dateHelpers';
import { PackageX, PackageCheck } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import TextAreaField from '../common/TextAreaField'; // For cancellation note

const FulfillRewards = ({ familyId, pendingRewards, kidsInFamily, allRewardsList, showConfirmation, firebaseUser }) => {
    // Removed rewardToProcess and cancellationNote state from here, as they are managed by ConfirmationModal's modalUiState

    const closeModals = () => {
        // This function might not be strictly needed if ConfirmationModal handles its own closure,
        // but can be kept for explicit clearing if other local state depended on it.
    };

    const triggerFulfillConfirmation = (redeemedReward) => {
        const originalRewardDetails = allRewardsList.find(r => r.id === redeemedReward.rewardId);
        const processThisFulfillment = async (modalUiState) => { // modalUiState will contain { cloneReward: boolean }
            if (!redeemedReward) return;
            try {
                const batch = writeBatch(db);
                const redeemedRewardRef = doc(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards'), redeemedReward.id);
                batch.update(redeemedRewardRef, {
                    status: 'fulfilled', dateFulfilled: Timestamp.now(),
                    fulfilledBy: firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System',
                });
                if (modalUiState.cloneReward && originalRewardDetails) {
                    const newRewardData = { ...originalRewardDetails, createdAt: Timestamp.now(), isAvailable: true };
                    delete newRewardData.id;
                    batch.set(doc(collection(db, getFamilyScopedCollectionPath(familyId, 'rewards'))), newRewardData);
                }
                await batch.commit();
                closeModals();
            } catch (error) { console.error("Error fulfilling reward:", error); }
        };
        showConfirmation(
            "Confirm Fulfillment",
            `Mark "${redeemedReward.rewardName}" for ${kidsInFamily.find(k => k.id === redeemedReward.kidId)?.name} as fulfilled?`,
            processThisFulfillment, "Mark Fulfilled",
            (uiState, setUiState) => (
                <div>
                    <label className="flex items-center text-sm text-gray-700 mt-2">
                        <input type="checkbox" checked={!!uiState.cloneReward} onChange={(e) => setUiState(prev => ({ ...prev, cloneReward: e.target.checked }))} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        Re-list this reward for future redemption?
                    </label>
                </div>
            ), { cloneReward: false }
        );
    };

    const triggerCancelConfirmation = (redeemedReward) => {
        const processThisCancellation = async (modalUiState) => { // modalUiState will contain { cancellationNote: string }
            if (!redeemedReward) return;
            try {
                const batch = writeBatch(db);
                const redeemedRewardRef = doc(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards'), redeemedReward.id);
                const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), redeemedReward.kidId);
                const kidDoc = await getDoc(kidRef);
                if (!kidDoc.exists()) throw new Error("Kid not found for point refund.");
                batch.update(redeemedRewardRef, {
                    status: 'cancelled_by_parent', dateCancelled: Timestamp.now(),
                    cancellationNote: modalUiState.cancellationNote ? modalUiState.cancellationNote.trim() : null,
                    cancelledBy: firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System',
                });
                batch.update(kidRef, { points: (kidDoc.data().points || 0) + redeemedReward.pointsSpent });
                await batch.commit();
                closeModals();
            } catch (error) { console.error("Error cancelling reward request:", error); }
        };
        showConfirmation(
            "Cancel Reward Request",
            `Cancel request for "${redeemedReward.rewardName}" by ${kidsInFamily.find(k => k.id === redeemedReward.kidId)?.name}? Points will be returned.`,
            processThisCancellation, "Yes, Cancel & Return Points",
            (uiState, setUiState) => (
                <TextAreaField label="Reason for cancellation (optional):" value={uiState.cancellationNote || ""} onChange={e => setUiState(prev => ({ ...prev, cancellationNote: e.target.value }))} placeholder="e.g., Item out of stock" />
            ), { cancellationNote: "" }
        );
    };

    if (pendingRewards.length === 0) {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Fulfill Rewards</h3><p className="text-gray-500">No rewards pending fulfillment.</p></Card>;
    }

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Fulfill Rewards</h3>
            <ul className="space-y-4">
                {pendingRewards.map(rr => {
                    const kid = kidsInFamily.find(k => k.id === rr.kidId);
                    return (
                        <li key={rr.id} className="p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start">
                                <div>
                                    <p className="font-semibold text-lg text-gray-800">{kid?.name || 'Unknown Kid'} redeemed: <span className="text-yellow-600">{rr.rewardName}</span></p>
                                    <p className="text-sm text-gray-500">Requested: {formatShortDate(rr.dateRedeemed)}</p>
                                    <p className="text-sm text-gray-500">Cost: {rr.pointsSpent} points</p>
                                </div>
                                <div className="flex space-x-2 mt-2 sm:mt-0">
                                    <Button onClick={() => triggerCancelConfirmation(rr)} className="bg-red-500 hover:bg-red-600 text-sm" icon={PackageX}>Cancel</Button>
                                    <Button onClick={() => triggerFulfillConfirmation(rr)} className="bg-green-500 hover:bg-green-600 text-sm" icon={PackageCheck}>Fulfill</Button>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
};

export default FulfillRewards;