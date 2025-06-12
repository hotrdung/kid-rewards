// src/components/kid/KidRewardsList.js
import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { Gift, DollarSign } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';

const KidRewardsList = ({ kid, familyId, rewards, redeemedRewardsData, showConfirmation }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');
    const [rewardToRedeem, setRewardToRedeem] = useState(null);

    const confirmRedeemReward = (reward) => {
        if ((kid.points || 0) < reward.pointCost) {
            setShowFeedback("You don't have enough points for this reward."); setFeedbackType('error'); setTimeout(() => setShowFeedback(''), 3000); return;
        }
        setRewardToRedeem(reward);
        showConfirmation("Confirm Redemption", `Redeem "${reward.name}" for ${reward.pointCost} points?`, handleRedeemReward, "Redeem");
    };

    const handleRedeemReward = async () => {
        if (!rewardToRedeem) return;
        if ((kid.points || 0) < rewardToRedeem.pointCost) {
            setShowFeedback("Not enough points (checked again). Please earn more!"); setFeedbackType('error'); setTimeout(() => setShowFeedback(''), 3000); setRewardToRedeem(null); return;
        }
        try {
            const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), kid.id);
            const batch = writeBatch(db);
            batch.update(kidRef, { points: (kid.points || 0) - rewardToRedeem.pointCost });
            const newRedeemedRewardRef = doc(collection(db, getFamilyScopedCollectionPath(familyId, 'redeemedRewards')));
            batch.set(newRedeemedRewardRef, { kidId: kid.id, kidName: kid.name, rewardId: rewardToRedeem.id, rewardName: rewardToRedeem.name, pointsSpent: rewardToRedeem.pointCost, dateRedeemed: Timestamp.now(), status: 'pending_fulfillment' });
            await batch.commit();
            setShowFeedback(`"${rewardToRedeem.name}" redeemed! Your parent will fulfill it soon.`); setFeedbackType('success');
        } catch (error) {
            console.error("Error redeeming reward: ", error); setShowFeedback('Oops! Something went wrong while redeeming. Please try again.'); setFeedbackType('error');
        } finally {
            setRewardToRedeem(null); setTimeout(() => setShowFeedback(''), 4000);
        }
    };

    const availableRewards = rewards.filter(r => {
        if (!r.isAvailable) return false;
        const existingRedemption = redeemedRewardsData.find(redeemed => redeemed.kidId === kid.id && redeemed.rewardId === r.id && (redeemed.status === 'pending_fulfillment' || redeemed.status === 'fulfilled'));
        return !existingRedemption;
    });

    const feedbackColor = { info: 'bg-blue-100 text-blue-700', success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Redeem Rewards</h3>
            {showFeedback && <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>{showFeedback}</p>}
            {availableRewards.length === 0 ? (
                <p className="text-gray-500">No rewards are currently available in your family. Check back later!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableRewards.map(r => (
                        <Card key={r.id} className="flex flex-col justify-between items-center text-center border border-yellow-300">
                            <Gift size={48} className="text-yellow-500 mb-3" />
                            <h4 className="font-semibold text-xl text-gray-800 mb-1">{r.name}</h4>
                            <p className="text-lg text-yellow-700 font-bold mb-3">{r.pointCost} points</p>
                            <Button
                                onClick={() => confirmRedeemReward(r)}
                                disabled={(kid.points || 0) < r.pointCost}
                                className={`w-full ${(kid.points || 0) < r.pointCost ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'}`}
                                icon={DollarSign}
                            >
                                {(kid.points || 0) < r.pointCost ? 'Not Enough Points' : 'Redeem'}
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default KidRewardsList;