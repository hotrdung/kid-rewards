// src/components/kid/KidDashboard.js
import React, { useState, useMemo } from 'react';
import { User, ClipboardList, Gift, ListOrdered, ListChecks } from 'lucide-react';
import Card from '../common/Card';
import KidProfile from './KidProfile';
import KidTasksList from './KidTasksList';
import KidRewardsList from './KidRewardsList';
import KidHistory from './KidHistory';
import KidHighscores from './KidHighscores';
import { getStartOfDay, getStartOfWeek, getStartOfMonth } from '../../utils/dateHelpers';

const KidDashboard = ({ kidData, familyId, allTasks, rewards, completedTasks, redeemedRewardsData, showConfirmation }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const kid = kidData;

    const pointsToday = useMemo(() => {
        const todayStart = getStartOfDay(new Date());
        return completedTasks
            .filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= todayStart)
            .reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pointsThisWeek = useMemo(() => {
        const weekStart = getStartOfWeek(new Date());
        return completedTasks
            .filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= weekStart)
            .reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pointsThisMonth = useMemo(() => {
        const monthStart = getStartOfMonth(new Date());
        return completedTasks
            .filter(ct => ct.kidId === kid.id && ct.status === 'approved' && ct.dateApprovedOrRejected?.toDate() >= monthStart)
            .reduce((sum, ct) => sum + (ct.pointsAwarded || 0), 0);
    }, [completedTasks, kid.id]);

    const pendingPoints = useMemo(() => {
        return completedTasks
            ?.filter(ct => ct.kidId === kid.id && ct.status === 'pending_approval')
            .reduce((sum, ct) => sum + (ct.taskPoints || 0), 0) || 0;
    }, [completedTasks, kid.id]);

    const NavItem = ({ tabName, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center px-3 py-2 sm:px-4 sm:py-3 rounded-lg transition-colors duration-150 text-sm sm:text-base ${activeTab === tabName ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-green-100'}`}
        >
            <Icon size={20} className="mr-2" /> {label}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <KidProfile kid={kid} pointsToday={pointsToday} pointsThisWeek={pointsThisWeek} pointsThisMonth={pointsThisMonth} pendingPoints={pendingPoints} />;
            case 'tasks': return <KidTasksList kid={kid} familyId={familyId} allTasks={allTasks} completedTasks={completedTasks} showConfirmation={showConfirmation} />;
            case 'rewards': return <KidRewardsList kid={kid} familyId={familyId} rewards={rewards} redeemedRewardsData={redeemedRewardsData} showConfirmation={showConfirmation} />;
            case 'history': return <KidHistory kid={kid} familyId={familyId} completedTasks={completedTasks} redeemedRewards={redeemedRewardsData} />;
            case 'highscores': return <KidHighscores currentKid={kid} currentFamilyId={familyId} />;
            default: return <KidProfile kid={kid} pointsToday={pointsToday} pointsThisWeek={pointsThisWeek} pointsThisMonth={pointsThisMonth} pendingPoints={pendingPoints} />;
        }
    };

    if (!kid) return <p>Loading kid data...</p>;

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
                <h2 className="text-3xl font-semibold mb-1">Hi, {kid.name}!</h2>
                <p className="text-lg">Ready to earn points?</p>
                <div className="mt-4 text-2xl font-bold">
                    Your Total Points: <span className="bg-white text-green-600 px-3 py-1 rounded-full shadow">{kid.points || 0}</span>
                </div>
            </Card>
            <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-2">
                    <NavItem tabName="profile" icon={User} label="My Profile" />
                    <NavItem tabName="tasks" icon={ClipboardList} label="My Tasks" />
                    <NavItem tabName="rewards" icon={Gift} label="Redeem Rewards" />
                    <NavItem tabName="highscores" icon={ListOrdered} label="Highscores" />
                    <NavItem tabName="history" icon={ListChecks} label="My History" />
                </div>
            </nav>
            <div>{renderContent()}</div>
        </div>
    );
};

export default KidDashboard;