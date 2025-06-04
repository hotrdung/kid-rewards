/* global __firebase_config, __app_id, __initial_auth_token */

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithCustomToken
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, CheckCircle, Gift, User, LogOut, Eye, DollarSign, ListChecks, ShieldCheck, Award, Home, Users, ClipboardList, Trophy, Bell } from 'lucide-react';

// --- Firebase Configuration ---
// If __firebase_config is provided (e.g., by the Canvas environment), it will be used.
// Otherwise, it falls back to using environment variables (process.env.REACT_APP_...)
// which you would set in a .env file for local development.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID
    };

// --- App ID Configuration ---
// If __app_id is provided, it's used. Otherwise, it falls back to an environment variable or a default.
const appId = typeof __app_id !== 'undefined' 
    ? __app_id 
    : (process.env.REACT_APP_CHORE_APP_ID || 'default-chore-app');

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// For debugging Firestore, import { setLogLevel } from "firebase/firestore"; setLogLevel('debug'); // Uncomment if needed

// --- Firestore Collection Paths ---
const getCollectionPath = (collectionName) => `/artifacts/${appId}/public/data/${collectionName}`;
const kidsCollectionPath = getCollectionPath('kids');
const tasksCollectionPath = getCollectionPath('tasks');
const rewardsCollectionPath = getCollectionPath('rewards');
const completedTasksCollectionPath = getCollectionPath('completedTasks');
const redeemedRewardsCollectionPath = getCollectionPath('redeemedRewards');

// --- Helper Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const Button = ({ onClick, children, className = 'bg-blue-500 hover:bg-blue-600', icon: Icon, disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {Icon && <Icon size={18} className="mr-2" />}
        {children}
    </button>
);

const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);

const Card = ({ children, className = '' }) => (
    <div className={`bg-white shadow-lg rounded-xl p-6 ${className}`}>
        {children}
    </div>
);

// --- Main App Component ---
function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [role, setRole] = useState(null); // 'parent' or 'kid'
    const [selectedKid, setSelectedKid] = useState(null); // Kid object for kid view

    const [kids, setKids] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [redeemedRewardsData, setRedeemedRewardsData] = useState([]); // Renamed to avoid conflict if passed as prop

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [currentUserId, setCurrentUserId] = useState(null);


    // Firebase Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setCurrentUserId(user.uid); // Set currentUserId from auth
            } else {
                // Try custom token first, then anonymous
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (authError) {
                    console.error("Authentication error:", authError);
                    setError("Failed to authenticate. Please try again later.");
                }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);


    // Fetch initial data
    useEffect(() => {
        if (!isAuthReady || !currentUser) {
            setIsLoading(false); // Not ready to fetch
            return;
        }
        
        setIsLoading(true);
        const collectionsToFetch = [
            { path: kidsCollectionPath, setter: setKids },
            { path: tasksCollectionPath, setter: setTasks },
            { path: rewardsCollectionPath, setter: setRewards },
            { path: completedTasksCollectionPath, setter: setCompletedTasks },
            { path: redeemedRewardsCollectionPath, setter: setRedeemedRewardsData }, // Updated setter
        ];

        const unsubscribes = collectionsToFetch.map(col => {
            const q = query(collection(db, col.path));
            return onSnapshot(q, (snapshot) => {
                const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                col.setter(dataList);
            }, (err) => {
                console.error(`Error fetching ${col.path}:`, err);
                setError(`Failed to load data from ${col.path}.`);
            });
        });
        
        // Set loading to false after attempting to set up listeners
        // It's possible some listeners might not immediately return data,
        // but the app should still render.
        setIsLoading(false); 
        return () => unsubscribes.forEach(unsub => unsub());
    }, [isAuthReady, currentUser]);


    const handleRoleSelect = (selectedRole) => {
        setRole(selectedRole);
        setSelectedKid(null); // Reset kid selection
        if (selectedRole === 'parent') {
             // For parent, we don't need to select a specific kid profile initially
        }
    };

    const handleKidSelect = (kid) => {
        setSelectedKid(kid);
        setRole('kid');
    };

    const handleLogout = () => {
        setRole(null);
        setSelectedKid(null);
        // Note: Firebase anonymous user remains signed in. 
        // For full logout, you might need `auth.signOut()` if using persistent auth.
    };
    
    if (!isAuthReady) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold">Initializing App...</div></div>;
    }
    
    // Show loading indicator if auth is ready, user exists, but still loading data
    if (isLoading && isAuthReady && currentUser) { 
      return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold">Loading Data...</div></div>;
    }

    if (error) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold text-red-500 p-4 bg-red-100 rounded-md">{error}</div></div>;
    }


    if (!role) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">Kids Chore & Reward</h1>
                    <p className="text-xl text-purple-200">Welcome! Please select your role or profile.</p>
                    {currentUserId && <p className="text-xs text-purple-300 mt-2">App ID: {appId} | User ID: {currentUserId}</p>}
                </div>
                
                <Card className="w-full max-w-md">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">Who are you?</h2>
                    <Button onClick={() => handleRoleSelect('parent')} className="w-full mb-4 bg-indigo-500 hover:bg-indigo-600" icon={ShieldCheck}>
                        I'm a Parent
                    </Button>
                    <hr className="my-4"/>
                    <h3 className="text-lg font-medium text-gray-600 mb-3 text-center">Or, select a Kid Profile:</h3>
                    {kids.length > 0 ? (
                        <div className="space-y-2">
                            {kids.map(kid => (
                                <Button key={kid.id} onClick={() => handleKidSelect(kid)} className="w-full bg-green-500 hover:bg-green-600" icon={User}>
                                    {kid.name}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">No kid profiles available. A parent needs to add them first.</p>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center">
                       <Award size={32} className="text-purple-600 mr-2" />
                       <h1 className="text-2xl font-bold text-gray-700">Chore Rewards</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        {currentUserId && <p className="text-xs text-gray-500 hidden sm:block">User ID: {currentUserId}</p>}
                        {role && <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-700">{role === 'parent' ? 'Parent View' : `Kid: ${selectedKid?.name}`}</span>}
                        <Button onClick={handleLogout} className="bg-gray-500 hover:bg-gray-600" icon={LogOut}>
                            Change Role
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6">
                {role === 'parent' && <ParentDashboard kids={kids} tasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewards={redeemedRewardsData} />}
                {role === 'kid' && selectedKid && <KidDashboard kid={selectedKid} tasks={tasks} rewards={rewards} completedTasks={completedTasks.filter(ct => ct.kidId === selectedKid.id)} redeemedRewards={redeemedRewardsData.filter(rr => rr.kidId === selectedKid.id)} />}
            </main>
            <footer className="text-center py-6 text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} Chore Rewards App. App ID: {appId}</p>
            </footer>
        </div>
    );
}

// --- Parent Dashboard ---
const ParentDashboard = ({ kids, tasks, rewards, completedTasks, redeemedRewards }) => { // Added redeemedRewards prop
    const [activeTab, setActiveTab] = useState('kids'); // kids, tasks, rewards, approve, history

    const pendingTasks = completedTasks.filter(task => task.status === 'pending');
    // Use the passed prop for redeemed rewards
    const allRedeemedRewards = redeemedRewards; 

    const renderContent = () => {
        switch (activeTab) {
            case 'kids': return <ManageKids kids={kids} />;
            case 'tasks': return <ManageTasks tasks={tasks} />;
            case 'rewards': return <ManageRewards rewards={rewards} />;
            case 'approve': return <ApproveTasks pendingTasks={pendingTasks} kids={kids} tasks={tasks}/>;
            case 'history': return <ParentRewardHistory redeemedRewards={allRedeemedRewards} kids={kids} rewards={rewards} />;
            default: return <ManageKids kids={kids} />;
        }
    };
    
    const NavItem = ({ tabName, icon: Icon, label, count }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-150 ${activeTab === tabName ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-purple-100'}`}
        >
            <Icon size={20} className="mr-2" />
            {label}
            {count > 0 && <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{count}</span>}
        </button>
    );

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-3xl font-semibold text-gray-800 mb-2">Parent Dashboard</h2>
                <p className="text-gray-600">Manage chores, rewards, and your kids' progress.</p>
            </Card>
            <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-2">
                    <NavItem tabName="kids" icon={Users} label="Manage Kids" />
                    <NavItem tabName="tasks" icon={ClipboardList} label="Manage Tasks" />
                    <NavItem tabName="rewards" icon={Trophy} label="Manage Rewards" />
                    <NavItem tabName="approve" icon={Bell} label="Approve Tasks" count={pendingTasks.length} />
                    <NavItem tabName="history" icon={ListChecks} label="Reward History" />
                </div>
            </nav>
            <div>{renderContent()}</div>
        </div>
    );
};


// --- Manage Kids (Parent) ---
const ManageKids = ({ kids }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [kidName, setKidName] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [kidToDelete, setKidToDelete] = useState(null);


    const handleAddKid = async () => {
        if (!kidName.trim()) return;
        try {
            await addDoc(collection(db, kidsCollectionPath), {
                name: kidName.trim(),
                points: 0,
                createdAt: Timestamp.now()
            });
            setKidName('');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding kid: ", error);
        }
    };
    
    const confirmDeleteKid = (kid) => {
        setKidToDelete(kid);
        setShowConfirmModal(true);
    };

    const handleDeleteKid = async () => {
        if (!kidToDelete) return;
        try {
            const kidId = kidToDelete.id;
            // Advanced: Delete associated data in a batch
            const batch = writeBatch(db);
            
            // Delete completed tasks for this kid
            const completedTasksQuery = query(collection(db, completedTasksCollectionPath), where("kidId", "==", kidId));
            const completedTasksSnapshot = await getDocs(completedTasksQuery);
            completedTasksSnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete redeemed rewards for this kid
            const redeemedRewardsQuery = query(collection(db, redeemedRewardsCollectionPath), where("kidId", "==", kidId));
            const redeemedRewardsSnapshot = await getDocs(redeemedRewardsQuery);
            redeemedRewardsSnapshot.forEach(doc => batch.delete(doc.ref));
            
            // Delete the kid document
            batch.delete(doc(db, kidsCollectionPath, kidId));
            
            await batch.commit();
        } catch (error) {
            console.error("Error deleting kid and associated data: ", error);
        } finally {
            setShowConfirmModal(false);
            setKidToDelete(null);
        }
    };


    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Kids</h3>
                <Button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600" icon={PlusCircle}>Add Kid</Button>
            </div>
            {kids.length === 0 ? <p className="text-gray-500">No kids added yet.</p> : (
                <ul className="space-y-3">
                    {kids.map(kid => (
                        <li key={kid.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{kid.name}</span>
                                <span className="ml-4 text-sm text-purple-600 font-semibold">{kid.points} points</span>
                            </div>
                             <Button onClick={() => confirmDeleteKid(kid)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Kid">
                <InputField label="Kid's Name" value={kidName} onChange={e => setKidName(e.target.value)} placeholder="e.g., Alex" required />
                <Button onClick={handleAddKid} className="w-full bg-green-500 hover:bg-green-600">Add Kid</Button>
            </Modal>

            <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete kid "{kidToDelete?.name}" and all their associated data? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteKid} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Manage Tasks (Parent) ---
const ManageTasks = ({ tasks }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskName, setTaskName] = useState('');
    const [taskPoints, setTaskPoints] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);

    const handleAddTask = async () => {
        if (!taskName.trim() || !taskPoints || isNaN(parseInt(taskPoints)) || parseInt(taskPoints) <= 0) {
            alert("Please enter a valid task name and a positive point value."); // Using alert for now, replace with modal if preferred
            return;
        }
        try {
            await addDoc(collection(db, tasksCollectionPath), {
                name: taskName.trim(),
                points: parseInt(taskPoints),
                isActive: true,
                createdAt: Timestamp.now()
            });
            setTaskName('');
            setTaskPoints('');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding task: ", error);
        }
    };
    
    const confirmDeleteTask = (task) => {
        setTaskToDelete(task);
        setShowConfirmModal(true);
    };

    const handleDeleteTask = async () => {
        if(!taskToDelete) return;
        try {
            await deleteDoc(doc(db, tasksCollectionPath, taskToDelete.id));
        } catch (error) {
            console.error("Error deleting task: ", error);
        } finally {
            setShowConfirmModal(false);
            setTaskToDelete(null);
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Tasks</h3>
                <Button onClick={() => setIsModalOpen(true)} className="bg-teal-500 hover:bg-teal-600" icon={PlusCircle}>Add Task</Button>
            </div>
             {tasks.length === 0 ? <p className="text-gray-500">No tasks defined yet.</p> : (
                <ul className="space-y-3">
                    {tasks.map(task => (
                        <li key={task.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{task.name}</span>
                                <span className="ml-4 text-sm text-teal-600 font-semibold">{task.points} points</span>
                            </div>
                            <Button onClick={() => confirmDeleteTask(task)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Task">
                <InputField label="Task Name" value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g., Clean room" required />
                <InputField label="Points" type="number" value={taskPoints} onChange={e => setTaskPoints(e.target.value)} placeholder="e.g., 10" required />
                <Button onClick={handleAddTask} className="w-full bg-teal-500 hover:bg-teal-600">Add Task</Button>
            </Modal>
            <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete task "{taskToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteTask} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Manage Rewards (Parent) ---
const ManageRewards = ({ rewards }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rewardName, setRewardName] = useState('');
    const [rewardCost, setRewardCost] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [rewardToDelete, setRewardToDelete] = useState(null);


    const handleAddReward = async () => {
        if (!rewardName.trim() || !rewardCost || isNaN(parseInt(rewardCost)) || parseInt(rewardCost) <= 0) {
            alert("Please enter a valid reward name and a positive point cost."); // Using alert, replace with modal if preferred
            return;
        }
        try {
            await addDoc(collection(db, rewardsCollectionPath), {
                name: rewardName.trim(),
                pointCost: parseInt(rewardCost),
                isAvailable: true,
                createdAt: Timestamp.now()
            });
            setRewardName('');
            setRewardCost('');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding reward: ", error);
        }
    };
    
    const confirmDeleteReward = (reward) => {
        setRewardToDelete(reward);
        setShowConfirmModal(true);
    };

    const handleDeleteReward = async () => {
        if(!rewardToDelete) return;
        try {
            await deleteDoc(doc(db, rewardsCollectionPath, rewardToDelete.id));
        } catch (error) {
            console.error("Error deleting reward: ", error);
        } finally {
            setShowConfirmModal(false);
            setRewardToDelete(null);
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Rewards</h3>
                <Button onClick={() => setIsModalOpen(true)} className="bg-yellow-500 hover:bg-yellow-600" icon={PlusCircle}>Add Reward</Button>
            </div>
            {rewards.length === 0 ? <p className="text-gray-500">No rewards defined yet.</p> : (
                <ul className="space-y-3">
                    {rewards.map(reward => (
                        <li key={reward.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{reward.name}</span>
                                <span className="ml-4 text-sm text-yellow-700 font-semibold">{reward.pointCost} points</span>
                            </div>
                            <Button onClick={() => confirmDeleteReward(reward)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Reward">
                <InputField label="Reward Name" value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="e.g., Extra screen time" required />
                <InputField label="Point Cost" type="number" value={rewardCost} onChange={e => setRewardCost(e.target.value)} placeholder="e.g., 50" required />
                <Button onClick={handleAddReward} className="w-full bg-yellow-500 hover:bg-yellow-600">Add Reward</Button>
            </Modal>
            <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete reward "{rewardToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteReward} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Approve Tasks (Parent) ---
const ApproveTasks = ({ pendingTasks, kids, tasks }) => {
    const handleApproveTask = async (completedTaskId, kidId, taskPoints) => {
        try {
            const kidRef = doc(db, kidsCollectionPath, kidId);
            const completedTaskRef = doc(db, completedTasksCollectionPath, completedTaskId);

            const kidDoc = await getDoc(kidRef);
            if (kidDoc.exists()) {
                const currentPoints = kidDoc.data().points || 0;
                
                const batch = writeBatch(db);
                batch.update(kidRef, {
                    points: currentPoints + taskPoints
                });
                batch.update(completedTaskRef, {
                    status: 'approved',
                    dateApproved: Timestamp.now()
                });
                await batch.commit();

            } else {
                console.error("Kid document not found for approval");
            }
        } catch (error) {
            console.error("Error approving task: ", error);
        }
    };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Approve Tasks</h3>
            {pendingTasks.length === 0 ? <p className="text-gray-500">No tasks pending approval.</p> : (
                <ul className="space-y-4">
                    {pendingTasks.map(ct => {
                        const kid = kids.find(k => k.id === ct.kidId);
                        const task = tasks.find(t => t.id === ct.taskId);
                        if (!kid || !task) {
                            console.warn("Missing kid or task data for pending task ID:", ct.id, "Kid ID:", ct.kidId, "Task ID:", ct.taskId);
                            return <li key={ct.id} className="text-orange-500 p-3 bg-orange-50 rounded-md">Task or Kid data missing for a pending task. It might have been deleted.</li>;
                        }
                        
                        return (
                            <li key={ct.id} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <p className="font-semibold text-lg text-gray-800">{kid.name} completed: <span className="text-blue-600">{task.name}</span></p>
                                    <p className="text-sm text-gray-500">Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()}</p>
                                    <p className="text-sm text-purple-600 font-semibold">Points: {task.points}</p>
                                </div>
                                <Button onClick={() => handleApproveTask(ct.id, kid.id, task.points)} className="bg-green-500 hover:bg-green-600" icon={CheckCircle}>
                                    Approve
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};


// --- Parent Reward History ---
const ParentRewardHistory = ({ redeemedRewards, kids, rewards }) => {
    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Reward Redemption History</h3>
            {redeemedRewards.length === 0 ? (
                <p className="text-gray-500">No rewards have been redeemed yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kid</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points Spent</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {redeemedRewards.sort((a, b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis()).map(rr => {
                                const kid = kids.find(k => k.id === rr.kidId);
                                const reward = rewards.find(r => r.id === rr.rewardId);
                                return (
                                    <tr key={rr.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rr.dateRedeemed?.toDate().toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{kid?.name || 'N/A (Kid Deleted)'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reward?.name || 'N/A (Reward Deleted)'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rr.pointsSpent}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
};


// --- Kid Dashboard ---
const KidDashboard = ({ kid, tasks, rewards, completedTasks, redeemedRewards }) => {
    const [activeTab, setActiveTab] = useState('profile'); // profile, tasks, rewards, history
    const kidProfile = kid; // The full kid object is passed

    // Ensure completedTasks and redeemedRewards are arrays before filtering
    const kidSpecificCompletedTasks = Array.isArray(completedTasks) ? completedTasks.filter(ct => ct.kidId === kid.id) : [];
    const kidSpecificRedeemedRewards = Array.isArray(redeemedRewards) ? redeemedRewards.filter(rr => rr.kidId === kid.id) : [];
    
    const NavItem = ({ tabName, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-150 ${activeTab === tabName ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-green-100'}`}
        >
            <Icon size={20} className="mr-2" />
            {label}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <KidProfile kid={kidProfile} />;
            case 'tasks': return <KidTasksList kid={kidProfile} tasks={tasks} completedTasks={kidSpecificCompletedTasks} />;
            case 'rewards': return <KidRewardsList kid={kidProfile} rewards={rewards} />;
            case 'history': return <KidHistory completedTasks={kidSpecificCompletedTasks} redeemedRewards={kidSpecificRedeemedRewards} tasks={tasks} rewards={rewards} />;
            default: return <KidProfile kid={kidProfile} />;
        }
    };

    if (!kidProfile) return <p>Loading kid data...</p>;

    return (
        <div className="space-y-6">
             <Card className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
                <h2 className="text-3xl font-semibold mb-1">Hi, {kidProfile.name}!</h2>
                <p className="text-lg">Ready to earn some points and get awesome rewards?</p>
                <div className="mt-4 text-2xl font-bold">
                    Your Points: <span className="bg-white text-green-600 px-3 py-1 rounded-full shadow">{kidProfile.points}</span>
                </div>
            </Card>
             <nav className="bg-white shadow rounded-lg p-2">
                <div className="flex flex-wrap gap-2">
                    <NavItem tabName="profile" icon={User} label="My Profile" />
                    <NavItem tabName="tasks" icon={ClipboardList} label="Available Tasks" />
                    <NavItem tabName="rewards" icon={Gift} label="Redeem Rewards" />
                    <NavItem tabName="history" icon={ListChecks} label="My History" />
                </div>
            </nav>
            <div>{renderContent()}</div>
        </div>
    );
};

// --- Kid Profile ---
const KidProfile = ({ kid }) => (
    <Card>
        <h3 className="text-2xl font-semibold text-gray-700 mb-4">My Profile</h3>
        <p className="text-lg"><strong>Name:</strong> {kid.name}</p>
        <p className="text-lg"><strong>Current Points:</strong> <span className="font-bold text-purple-600">{kid.points}</span></p>
    </Card>
);

// --- Kid Tasks List ---
const KidTasksList = ({ kid, tasks, completedTasks }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'


    const handleCompleteTask = async (task) => {
        // Check if this task has already been submitted and is pending or approved today
        const today = new Date().toLocaleDateString();
        const alreadySubmittedToday = completedTasks.find(ct => 
            ct.taskId === task.id && 
            ct.kidId === kid.id &&
            (ct.status === 'pending' || ct.status === 'approved') &&
            ct.dateSubmitted?.toDate().toLocaleDateString() === today // Added optional chaining for dateSubmitted
        );

        if (alreadySubmittedToday) {
            setShowFeedback(`You've already submitted "${task.name}" today. Status: ${alreadySubmittedToday.status}.`);
            setFeedbackType('info');
            setTimeout(() => setShowFeedback(''), 3000);
            return;
        }

        try {
            await addDoc(collection(db, completedTasksCollectionPath), {
                kidId: kid.id,
                kidName: kid.name, // denormalize for easier display
                taskId: task.id,
                taskName: task.name, // denormalize
                taskPoints: task.points, // denormalize
                dateSubmitted: Timestamp.now(),
                status: 'pending' // 'pending', 'approved'
            });
            setShowFeedback(`Task "${task.name}" submitted for approval!`);
            setFeedbackType('success');
            setTimeout(() => setShowFeedback(''), 3000);
        } catch (error) {
            console.error("Error completing task: ", error);
            setShowFeedback('Error submitting task. Please try again.');
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 3000);
        }
    };
    
    const availableTasks = tasks.filter(task => task.isActive);
    
    const feedbackColor = {
        info: 'bg-blue-100 text-blue-700',
        success: 'bg-green-100 text-green-700',
        error: 'bg-red-100 text-red-700',
    };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Available Tasks</h3>
            {showFeedback && <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>{showFeedback}</p>}
            {availableTasks.length === 0 ? <p className="text-gray-500">No tasks available right now. Check back later!</p> : (
                <ul className="space-y-4">
                    {availableTasks.map(task => {
                         const submittedToday = completedTasks.find(ct => 
                            ct.taskId === task.id && 
                            ct.kidId === kid.id &&
                            (ct.status === 'pending' || ct.status === 'approved') &&
                            ct.dateSubmitted?.toDate().toLocaleDateString() === new Date().toLocaleDateString() // Added optional chaining
                        );
                        return (
                            <li key={task.id} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <span className="font-semibold text-lg text-gray-800">{task.name}</span>
                                    <p className="text-sm text-purple-600 font-semibold">{task.points} points</p>
                                </div>
                                {submittedToday ? (
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${submittedToday.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                                        {submittedToday.status === 'pending' ? 'Pending Approval' : 'Approved Today'}
                                    </span>
                                ) : (
                                    <Button onClick={() => handleCompleteTask(task)} className="bg-blue-500 hover:bg-blue-600" icon={CheckCircle}>
                                        I Did This!
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};

// --- Kid Rewards List ---
const KidRewardsList = ({ kid, rewards }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');


    const handleRedeemReward = async (reward) => {
        if (kid.points < reward.pointCost) {
            setShowFeedback("Not enough points to redeem this reward.");
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 3000);
            return;
        }
        try {
            const kidRef = doc(db, kidsCollectionPath, kid.id);
            
            const batch = writeBatch(db);

            batch.update(kidRef, {
                points: kid.points - reward.pointCost
            });

            // Create a new document reference for the redeemed reward
            const newRedeemedRewardRef = doc(collection(db, redeemedRewardsCollectionPath));
            batch.set(newRedeemedRewardRef, { // Use .set() with the new ref
                kidId: kid.id,
                kidName: kid.name, 
                rewardId: reward.id,
                rewardName: reward.name, 
                pointsSpent: reward.pointCost,
                dateRedeemed: Timestamp.now()
            });
            
            await batch.commit();

            setShowFeedback(`Reward "${reward.name}" redeemed successfully!`);
            setFeedbackType('success');
            setTimeout(() => setShowFeedback(''), 3000);
        } catch (error) {
            console.error("Error redeeming reward: ", error);
            setShowFeedback('Error redeeming reward. Please try again.');
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 3000);
        }
    };
    
    const availableRewards = rewards.filter(reward => reward.isAvailable);

    const feedbackColor = {
        info: 'bg-blue-100 text-blue-700',
        success: 'bg-green-100 text-green-700',
        error: 'bg-red-100 text-red-700',
    };

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Redeem Rewards</h3>
            {showFeedback && <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>{showFeedback}</p>}
            {availableRewards.length === 0 ? <p className="text-gray-500">No rewards available to redeem right now.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableRewards.map(reward => (
                        <Card key={reward.id} className="flex flex-col justify-between items-center text-center border border-yellow-300">
                            <Gift size={48} className="text-yellow-500 mb-3" />
                            <h4 className="font-semibold text-xl text-gray-800 mb-1">{reward.name}</h4>
                            <p className="text-lg text-yellow-700 font-bold mb-3">{reward.pointCost} points</p>
                            <Button 
                                onClick={() => handleRedeemReward(reward)} 
                                disabled={kid.points < reward.pointCost}
                                className={`w-full ${kid.points < reward.pointCost ? 'bg-gray-400' : 'bg-yellow-500 hover:bg-yellow-600'}`}
                                icon={DollarSign}
                            >
                                {kid.points < reward.pointCost ? 'Not Enough Points' : 'Redeem'}
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </Card>
    );
};

// --- Kid History ---
const KidHistory = ({ completedTasks, redeemedRewards, tasks, rewards }) => {
    return (
        <div className="space-y-8">
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Completed Tasks</h3>
                {completedTasks.length === 0 ? <p className="text-gray-500">You haven't completed any tasks yet.</p> : (
                     <ul className="space-y-3">
                        {completedTasks.sort((a,b) => b.dateSubmitted.toMillis() - a.dateSubmitted.toMillis()).map(ct => {
                            const taskDetails = tasks.find(t => t.id === ct.taskId);
                            return (
                                <li key={ct.id} className="p-3 bg-gray-50 rounded-lg shadow-sm">
                                    <p className="font-medium text-gray-800">{ct.taskName || taskDetails?.name || 'Unknown Task'}</p>
                                    <p className="text-sm text-gray-500">
                                        Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()} - 
                                        Status: <span className={`font-semibold ${ct.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{ct.status}</span>
                                        {ct.status === 'approved' && ` (+${ct.taskPoints || taskDetails?.points || 0} pts)`}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Redeemed Rewards</h3>
                {redeemedRewards.length === 0 ? <p className="text-gray-500">You haven't redeemed any rewards yet.</p> : (
                    <ul className="space-y-3">
                        {redeemedRewards.sort((a,b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis()).map(rr => {
                             const rewardDetails = rewards.find(r => r.id === rr.rewardId);
                            return (
                                <li key={rr.id} className="p-3 bg-gray-50 rounded-lg shadow-sm">
                                    <p className="font-medium text-gray-800">{rr.rewardName || rewardDetails?.name || 'Unknown Reward'}</p>
                                    <p className="text-sm text-gray-500">
                                        Redeemed: {rr.dateRedeemed?.toDate().toLocaleDateString()} for {rr.pointsSpent} points
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default App;
