// src/components/admin/AdminSection.js
import React, { useState } from 'react';
import { Building, UserCog, UsersRound, HomeIcon } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import NavItemButton from '../common/NavItemButton';
import ManageFamilies from './ManageFamilies';
import ManageFamilyParents from './ManageFamilyParents';
import ManageHighscoreGroups from './ManageHighscoreGroups';
// Removed migrateDataToFamilyFunc and setErrorFunc from props, as AdminSection itself doesn't use them directly.
// They are used by sub-components or App.js directly.

const AdminSection = ({ user, families, showConfirmation, switchToFamilyView }) => {
    const [activeTab, setActiveTab] = useState('manageFamilies');

    const adminNavItems = [
        { name: 'manageFamilies', icon: Building, label: "Manage Families" },
        { name: 'manageFamilyParents', icon: UserCog, label: "Manage Family Parents" },
        { name: 'manageHighscoreGroups', icon: UsersRound, label: "Highscore Groups" },
    ];

    const parentRoles = user.familyRoles?.filter(r => r.role === 'parent') || [];

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-semibold text-gray-800 mb-1">Admin Section</h2>
                        <p className="text-gray-600 mb-3 sm:mb-0">Manage families and app settings.</p>
                    </div>
                    {parentRoles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 items-center">
                            {parentRoles.map(role => (
                                <Button
                                    key={role.familyId}
                                    onClick={() => switchToFamilyView(role)}
                                    className="bg-purple-500 hover:bg-purple-600 text-white text-sm py-1.5 px-3"
                                    icon={HomeIcon}
                                >
                                    Enter "{role.familyName}"
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
            <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                    {adminNavItems.map(item => (
                        <div key={item.name} className="flex-1 min-w-[120px] sm:min-w-0">
                            <NavItemButton
                                tabName={item.name}
                                icon={item.icon}
                                label={item.label}
                                currentActiveTab={activeTab}
                                onTabClick={(tabName) => setActiveTab(tabName)}
                            />
                        </div>
                    ))}
                </div>
            </nav>
            <div>
                {activeTab === 'manageFamilies' &&
                    <ManageFamilies
                        families={families}
                        showConfirmation={showConfirmation}
                        currentUser={user}
                    />
                }
                {activeTab === 'manageFamilyParents' &&
                    <ManageFamilyParents
                        families={families}
                        showConfirmation={showConfirmation}
                        currentUser={user}
                    />
                }
                {activeTab === 'manageHighscoreGroups' &&
                    <ManageHighscoreGroups showConfirmation={showConfirmation} currentUser={user} />
                }
            </div>
        </div>
    );
};

export default AdminSection;
