// src/components/parent/ParentDashboard.js
import React, { useState, useEffect, useMemo, useRef } from 'react'; // Added useMemo
import { ClipboardList, Trophy, Bell, Users, PackageCheck, ListChecks, MoreHorizontal, UserCog, Eye as EyeIcon, ListOrdered } from 'lucide-react'; // Added ListOrdered
import Card from '../common/Card';
import Button from '../common/Button';
import NavItemButton from '../common/NavItemButton';
import ManageKids from './ManageKids';
import ManageTasks from './ManageTasks';
import ManageRewards from './ManageRewards';
import ApproveTasks from './ApproveTasks';
import FulfillRewards from './FulfillRewards';
import ParentRewardHistory from './ParentRewardHistory';
import KidHighscores from '../kid/KidHighscores'; // Import KidHighscores

const ParentDashboard = ({ user, familyId, kids, tasks, rewards, completedTasks, redeemedRewardsData, showConfirmation, switchToAdminViewFunc, switchToFamilyViewFunc }) => {
    const [activeTab, setActiveTab] = useState('tasks');
    const [showMoreNav, setShowMoreNav] = useState(false);
    const moreNavContainerRef = useRef(null);

    const pendingTasks = completedTasks.filter(task => task.status === 'pending_approval');
    const pendingFulfillmentRewards = redeemedRewardsData.filter(reward => reward.status === 'pending_fulfillment');

    const mainNavItems = [
        { name: 'tasks', icon: ClipboardList, label: "Tasks" },
        { name: 'rewards', icon: Trophy, label: "Rewards" },
        { name: 'approveTasks', icon: Bell, label: "Approvals", count: pendingTasks.length },
    ];
    const moreNavItems = [
        { name: 'kids', icon: Users, label: "Kids" },
        { name: 'fulfillRewards', icon: PackageCheck, label: "Fulfill Rewards", count: pendingFulfillmentRewards.length },
        { name: 'history', icon: ListChecks, label: "History" },
        { name: 'highscores', icon: ListOrdered, label: "Highscores" },
    ];

    const handleTabClick = (tabName, isFromMoreMenu = false) => {
        console.log("handleTabClick - tabName:", tabName, "isFromMoreMenu:", isFromMoreMenu, "Current activeTab:", activeTab);
        setActiveTab(tabName);
        if (isFromMoreMenu) {
            setShowMoreNav(false);
        }
    };

    useEffect(() => {
        console.log("ParentDashboard - useEffect - activeTab:", activeTab);
        const handleClickOutside = (event) => {
            if (moreNavContainerRef.current && !moreNavContainerRef.current.contains(event.target)) {
                setShowMoreNav(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [moreNavContainerRef]);


    const renderContent = () => {
        switch (activeTab) {
            case 'kids': return <ManageKids parentUser={user} familyId={familyId} kidsInFamily={kids} completedTasks={completedTasks} showConfirmation={showConfirmation} />;
            case 'tasks': return <ManageTasks familyId={familyId} tasksInFamily={tasks} kidsInFamily={kids} completedTasks={completedTasks} showConfirmation={showConfirmation} />;
            case 'rewards': return <ManageRewards familyId={familyId} rewardsInFamily={rewards} allRedeemedRewardInstances={redeemedRewardsData} showConfirmation={showConfirmation} />;
            case 'approveTasks': return <ApproveTasks familyId={familyId} pendingTasks={pendingTasks} kidsInFamily={kids} allTasksInFamily={tasks} showConfirmation={showConfirmation} firebaseUser={user} />;
            case 'fulfillRewards': return <FulfillRewards familyId={familyId} pendingRewards={pendingFulfillmentRewards} kidsInFamily={kids} allRewardsList={rewards} showConfirmation={showConfirmation} firebaseUser={user} />;
            case 'history': return <ParentRewardHistory familyId={familyId} redeemedRewards={redeemedRewardsData} completedTasks={completedTasks} kidsInFamily={kids} rewardsInFamily={rewards} tasksInFamily={tasks} />;
            case 'highscores': return <KidHighscores currentFamilyId={familyId} />; // Pass currentFamilyId, currentKid is optional and not needed for parent view
            default: return <ManageTasks familyId={familyId} tasksInFamily={tasks} kidsInFamily={kids} completedTasks={completedTasks} showConfirmation={showConfirmation} />;
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-semibold text-gray-800 mb-1">Parent Dashboard</h2>
                        <p className="text-gray-600 mt-1">
                            Family: <span className="font-medium">{user.activeFamilyRole.familyName}</span>
                        </p>
                    </div>
                    {user.isSA && (
                        <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 items-center">
                            <Button
                                onClick={switchToAdminViewFunc}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-3"
                                icon={UserCog}
                            >
                                Admin Section
                            </Button>
                            {user.familyRoles
                                .filter(r => r.role === 'parent' && r.familyId !== user.activeFamilyRole.familyId)
                                .map(role => (
                                    <Button
                                        key={role.familyId}
                                        onClick={() => switchToFamilyViewFunc(role)}
                                        className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm py-1.5 px-3"
                                        icon={EyeIcon}
                                    >
                                        View "{role.familyName}"
                                    </Button>
                                ))
                            }
                        </div>
                    )}
                </div>
            </Card>
            <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                    {mainNavItems.map(item => (
                        <div key={item.name} className="flex-1 min-w-[80px] sm:min-w-0">
                            <NavItemButton
                                key={item.name} /* Add key directly to the component */
                                tabName={item.name} // Explicitly pass item.name as tabName
                                {...item} // You can still spread the rest of the item props (icon, label, count)
                                currentActiveTab={activeTab}
                                onTabClick={handleTabClick}
                            />
                        </div>
                    ))}
                    <div ref={moreNavContainerRef} className="relative flex-1 min-w-[80px] sm:min-w-0">
                        <button onClick={() => setShowMoreNav(!showMoreNav)} className={`flex items-center w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-sm text-gray-600 hover:bg-purple-100 ${showMoreNav ? 'bg-purple-100' : ''}`}>
                            <MoreHorizontal size={18} className="mr-2 flex-shrink-0" />
                            <span className="flex-grow">More</span>
                        </button>
                        {showMoreNav && (
                            <div className="absolute right-0 sm:left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                                {moreNavItems.map(item => (
                                    <NavItemButton
                                        key={item.name + '-more'} /* Ensure distinct keys */
                                        tabName={item.name} // This was already correct here
                                        {...item}
                                        currentActiveTab={activeTab}
                                        onTabClick={(tabName) => handleTabClick(tabName, true)}
                                        isMoreItem={true} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            <div>{renderContent()}</div>
        </div>
    );
};

export default ParentDashboard;