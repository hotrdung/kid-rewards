// src/components/kid/KidProfile.js
import React from 'react';
import { Mail, Info } from 'lucide-react';
import Card from '../common/Card';

const KidProfile = ({ kid, pointsToday, pointsThisWeek, pointsThisMonth, pendingPoints }) => (
    <Card>
        <h3 className="text-2xl font-semibold text-gray-700 mb-4">My Profile</h3>
        <p className="text-lg mb-1"><strong>Name:</strong> {kid.name}</p>
        {kid.email && (
            <p className="text-lg mb-1 flex items-center">
                <strong>Email:</strong> <Mail size={16} className="mx-1 text-gray-600" /> {kid.email}
            </p>
        )}

        <div className="text-lg mb-1">
            <strong>Current Redeemable Points:</strong> <span className="font-bold text-purple-600">{kid.points || 0}</span>
        </div>
        {pendingPoints > 0 && (
            <div className="text-sm mb-1 text-yellow-600 flex items-center">
                <Info size={14} className="mr-1" />
                <strong>Pending Approval:</strong> <span className="font-bold ml-1">{pendingPoints}</span>
            </div>
        )}
        <div className="text-lg mb-4">
            <strong>Total Ever Earned:</strong> <span className="font-bold text-green-600">{kid.totalEarnedPoints || 0}</span>
        </div>

        <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Points Earned (Approved):</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-blue-700 font-medium">Today</p>
                <p className="text-2xl font-bold text-blue-600">{pointsToday}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-green-700 font-medium">This Week</p>
                <p className="text-2xl font-bold text-green-600">{pointsThisWeek}</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg text-center">
                <p className="text-sm text-indigo-700 font-medium">This Month</p>
                <p className="text-2xl font-bold text-indigo-600">{pointsThisMonth}</p>
            </div>
        </div>
    </Card>
);

export default KidProfile;