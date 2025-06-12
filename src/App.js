import React, { useState, useEffect, useMemo } from 'react';
import { Award, LogOut, LogIn, UserCog, HomeIcon, EyeIcon as Eye } from 'lucide-react'; // Keep only App-level icons

import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';

import Button from './components/common/Button';
import ConfirmationModal from './components/common/ConfirmationModal';
import AdminSection from './components/admin/AdminSection';
import ParentDashboard from './components/parent/ParentDashboard';
import KidDashboard from './components/kid/KidDashboard';
import Card from './components/common/Card'; // For login screen

import { CURRENT_APP_ID, SYSTEM_ADMIN_EMAILS } from './constants/appConstants';
// --- Main App Component ---
function App() {
    const {
        firebaseAuthUser,
        loggedInUser,
        updateLoggedInUser, // Renamed from setLoggedInUser for clarity from hook
        isAuthReady,
        authLoading,
        authError,
        setAuthError, // Allow App to set auth-related errors
        handleLoginWithGoogle,
        handleLogout,
        // SYSTEM_ADMIN_EMAILS is now imported directly where needed or passed from useAuth if it's dynamic
    } = useAuth();

    const {
        allFamiliesForSA,
        // setAllFamiliesForSA, // If App.js needs to modify this directly
        kids,
        tasks,
        rewards,
        completedTasks,
        redeemedRewardsData,
        dataLoading,
        dataError,
        setDataError, // Allow App to set data-related errors
    } = useAppData(loggedInUser, isAuthReady, firebaseAuthUser);

    // Combined error state or individual error states from hooks
    const [appError, setAppError] = useState('');

    // Consolidate error display
    useEffect(() => {
        if (authError) setAppError(authError);
        else if (dataError) setAppError(dataError);
        else setAppError(''); // Clear if no errors from hooks
    }, [authError, dataError]);

    const setError = (message) => { // For general app errors or errors from components
        console.error("Global Error Set:", message);
        setAppError(message);
    };

    const [confirmModalState, setConfirmModalState] = useState({
        isOpen: false, title: '', message: '', onConfirm: () => { }, children: null,
        modalUiState: {}, // New: state for UI elements within the modal children
        _setModalUiStateDirectly: () => { } // New: internal updater
    });

    const showConfirmation = (
        title,
        message,
        onConfirmAction, // (modalUiState) => void
        confirmText = "Confirm",
        renderModalChildren = null, // (uiState, setUiState) => JSX
        initialModalUiState = {}
    ) => {
        // This function will be stored in confirmModalState to update modalUiState
        // It ensures that when FulfillRewards's checkbox calls it, App's state is updated.
        const setUiStateForCurrentModal = (updater) => {
            setConfirmModalState(prev => ({
                ...prev,
                modalUiState: typeof updater === 'function' ? updater(prev.modalUiState) : updater
            }));
        };

        setConfirmModalState({
            isOpen: true, title, message,
            onConfirm: onConfirmAction, // Will be wrapped later to pass modalUiState
            confirmText,
            children: renderModalChildren, // The render function itself
            modalUiState: initialModalUiState,
            _setModalUiStateDirectly: setUiStateForCurrentModal, // Pass the updater
        });
    };
    const closeConfirmation = () => setConfirmModalState(prev => ({ ...prev, isOpen: false, children: null, modalUiState: {} }));

    const switchToAdminView = () => {
        console.log('switchToAdminView called. Current loggedInUser:', loggedInUser);
        if (loggedInUser?.isSA) {
            console.log('User is SA. Setting activeFamilyRole to null.');
            updateLoggedInUser(prev => { // Use the updater from the hook
                const newState = { ...prev, activeFamilyRole: null };
                console.log('New loggedInUser state (target for admin view):', newState);
                return newState;
            });
        } else {
            console.log('User is not SA or loggedInUser is null. No action taken in switchToAdminView.');
        }
    };

    const switchToFamilyView = (familyRole) => {
        console.log('switchToFamilyView called with familyRole:', familyRole);
        const familyFromList = allFamiliesForSA.find(f => f.id === familyRole.familyId);
        const updatedRole = familyFromList ? { ...familyRole, familyName: familyFromList.familyName } : familyRole;
        console.log('Setting activeFamilyRole to:', updatedRole);
        updateLoggedInUser(prev => ({ ...prev, activeFamilyRole: updatedRole })); // Use the updater from the hook
    };

    if (!isAuthReady || authLoading || dataLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-xl font-semibold">Initializing App & Loading Data...</div>
            </div>
        );
    }
    if (appError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="text-xl font-semibold text-red-500 p-4 bg-red-100 rounded-md mb-4">
                    {appError}
                </div>
                <Button
                    onClick={() => { setAppError(''); setAuthError(''); setDataError(''); window.location.reload(); }}
                    className="bg-blue-500 hover:bg-blue-600"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    const isEffectivelyAnonymous = !firebaseAuthUser ||
        (firebaseAuthUser.isAnonymous &&
            (!loggedInUser || (!loggedInUser.isSA && !loggedInUser.activeFamilyRole)));

    if (isEffectivelyAnonymous) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-12">
                    <Award size={60} className="text-yellow-300 mx-auto mb-4" />
                    <h1 className="text-5xl font-bold text-white mb-4">Kid Rewards</h1>
                    <p className="text-xl text-purple-200">Login with Google to continue.</p>
                </div>
                <Card className="w-full max-w-md">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">Sign In</h2>
                    <Button onClick={handleLoginWithGoogle} className="w-full mb-4 bg-red-500 hover:bg-red-600 text-white" icon={LogIn}>
                        Login with Google
                    </Button>
                    <p className="text-xs text-gray-500 text-center mt-4">
                        Parents and Kids with registered emails can log in here.
                    </p>
                </Card>
                {SYSTEM_ADMIN_EMAILS.length === 0 && process.env.NODE_ENV === 'development' && (
                    <p className="mt-4 text-sm text-yellow-300 bg-black bg-opacity-20 p-2 rounded">
                        Dev Note: No SA emails configured.
                    </p>
                )}
            </div>
        );
    }

    if (!loggedInUser?.uid) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-4 text-white">
                <Award size={60} className="text-yellow-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold mb-4">Welcome!</h1>
                <p className="text-lg mb-6">Processing your account details...</p>
            </div>
        );
    }

    let viewToRender;
    if (loggedInUser.isSA && !loggedInUser.activeFamilyRole) {
        console.log("App.js: Rendering AdminSection for user:", loggedInUser.uid);
        viewToRender = <AdminSection user={loggedInUser} families={allFamiliesForSA} showConfirmation={showConfirmation} switchToFamilyView={switchToFamilyView} />;
    } else if (loggedInUser.activeFamilyRole?.role === 'parent') {
        console.log("App.js: Rendering ParentDashboard for user:", loggedInUser.uid, "Family:", loggedInUser.activeFamilyRole.familyName);
        viewToRender = <ParentDashboard user={loggedInUser} familyId={loggedInUser.activeFamilyRole.familyId} kids={kids} tasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewardsData={redeemedRewardsData} showConfirmation={showConfirmation} allRewardsGlobal={rewards} switchToAdminViewFunc={switchToAdminView} switchToFamilyViewFunc={switchToFamilyView} />;
    } else if (loggedInUser.activeFamilyRole?.role === 'kid') {
        const kidProfile = kids.find(k => k.authUid === loggedInUser.uid || k.email?.toLowerCase() === loggedInUser.email?.toLowerCase());
        if (kidProfile) {
            console.log("App.js: Rendering KidDashboard for user:", loggedInUser.uid, "Kid:", kidProfile.name);
            viewToRender = <KidDashboard kidData={{ ...kidProfile, points: kidProfile.points || 0, totalEarnedPoints: kidProfile.totalEarnedPoints || 0 }} familyId={loggedInUser.activeFamilyRole.familyId} allTasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewardsData={redeemedRewardsData} showConfirmation={showConfirmation} />;
        } else {
            console.warn("App.js: Kid profile not found for user:", loggedInUser.uid, "in family:", loggedInUser.activeFamilyRole.familyName);
            viewToRender = (
                <div className="text-center p-8">
                    <p className="text-xl text-red-500">
                        Your kid profile was not found in family "{loggedInUser.activeFamilyRole.familyName}".
                    </p>
                    <p>Please contact your parent.</p>
                </div>
            );
        }
    } else {
        console.log("App.js: Rendering fallback/welcome view for user:", loggedInUser.uid);
        viewToRender = (
            <div className="text-center p-8">
                <h2 className="text-2xl font-semibold mb-4">Welcome, {loggedInUser.displayName}!</h2>
                <p>Your role is not fully set up for a family view.</p>
                {loggedInUser.isSA && (
                    <p>You are a System Admin. <Button onClick={switchToAdminView}>Go to Admin Dashboard</Button></p>
                )}
                {loggedInUser.familyRoles?.length === 0 && !loggedInUser.isSA && (
                    <p>Please ask an Admin or Parent to add you to a family.</p>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center">
                        <Award size={32} className="text-purple-600 mr-2" />
                        <h1 className="text-2xl font-bold text-gray-700">Kid Rewards</h1>
                        {loggedInUser.activeFamilyRole && (
                            <span className="ml-2 text-sm text-gray-500 hidden sm:inline">
                                ({loggedInUser.activeFamilyRole.familyName})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <span className="text-sm text-gray-600 hidden sm:block">
                            {loggedInUser.displayName}
                            {loggedInUser.isSA && (
                                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    SA
                                </span>
                            )}
                        </span>

                        {loggedInUser.isSA && !loggedInUser.activeFamilyRole && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700 hidden md:inline">
                                Admin
                            </span>
                        )}
                        {loggedInUser.activeFamilyRole?.role === 'parent' && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-700">
                                Parent
                            </span>
                        )}
                        {!loggedInUser.isSA && loggedInUser.activeFamilyRole?.role === 'kid' && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">
                                Kid
                            </span>
                        )}

                        <Button
                            onClick={handleLogout}
                            className="bg-gray-500 hover:bg-gray-600 px-2 sm:px-4"
                            icon={LogOut}
                        >
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6">{viewToRender}</main>
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={closeConfirmation}
                title={confirmModalState.title}
                message={confirmModalState.message}
                onConfirm={() => {
                    if (typeof confirmModalState.onConfirm === 'function') {
                        confirmModalState.onConfirm(confirmModalState.modalUiState); // Pass UI state to the confirm action
                    }
                    closeConfirmation();
                }}
                confirmText={confirmModalState.confirmText}
                children={confirmModalState.children}
                modalUiState={confirmModalState.modalUiState}
                setModalUiState={confirmModalState._setModalUiStateDirectly}
            />
            <footer className="text-center py-6 text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} Kid Rewards App. App ID: {CURRENT_APP_ID}
            </footer>
        </div>
    );
}

export default App;
