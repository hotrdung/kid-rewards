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
    writeBatch,
    orderBy // Added for fetching tasks
} from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, CheckCircle, Gift, User, LogOut, Eye, DollarSign, ListChecks, ShieldCheck, Award, Home, Users, ClipboardList, Trophy, Bell, CalendarDays, Repeat, UserCheck, LockKeyhole } from 'lucide-react';

// --- Constants ---
const PARENT_PIN = process.env.REACT_APP_PARENT_PIN || "1234"; // For demo purposes. In a real app, this should be handled securely.

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
        appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID"
    };

const appId = typeof __app_id !== 'undefined' 
    ? __app_id 
    : (process.env.REACT_APP_CHORE_APP_ID || 'default-chore-app-enhanced');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getCollectionPath = (collectionName) => `/artifacts/${appId}/public/data/${collectionName}`;
const kidsCollectionPath = getCollectionPath('kids');
const tasksCollectionPath = getCollectionPath('tasks');
const rewardsCollectionPath = getCollectionPath('rewards');
const completedTasksCollectionPath = getCollectionPath('completedTasks');
const redeemedRewardsCollectionPath = getCollectionPath('redeemedRewards');

// --- Date Helper Functions ---
const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getEndOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust if Sunday is the first day
    return getStartOfDay(new Date(d.setDate(diff)));
};
const getEndOfWeek = (date) => {
    const startOfWeek = getStartOfWeek(date);
    return getEndOfDay(new Date(startOfWeek.setDate(startOfWeek.getDate() + 6)));
};
const getStartOfMonth = (date) => getStartOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
const getEndOfMonth = (date) => getEndOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

const calculateNextDueDate = (task) => {
    if (!task.recurrenceType || task.recurrenceType === 'none') return null;
    
    let newDueDate = task.nextDueDate ? task.nextDueDate.toDate() : new Date();
    if (newDueDate < new Date()) newDueDate = new Date(); // If overdue, start from today

    switch (task.recurrenceType) {
        case 'daily':
            newDueDate.setDate(newDueDate.getDate() + 1);
            break;
        case 'weekly':
            newDueDate.setDate(newDueDate.getDate() + 7);
            // Optionally, align to specific day of week if task.recurrenceDetails.dayOfWeek is set
            break;
        case 'monthly':
            newDueDate.setMonth(newDueDate.getMonth() + 1);
            // Optionally, align to specific day of month if task.recurrenceDetails.dayOfMonth is set
            break;
        default:
            return null;
    }
    return Timestamp.fromDate(getStartOfDay(newDueDate));
};


// --- Helper Components (Modal, Button, InputField, Card - unchanged, so not repeated for brevity) ---
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

const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false, maxLength }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);
const SelectField = ({ label, value, onChange, options, placeholder }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
            value={value}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
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
    const [authAttempt, setAuthAttempt] = useState(null); // null, 'parentPin', 'kidPin'
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [selectedKidForPin, setSelectedKidForPin] = useState(null);

    const [role, setRole] = useState(null); // 'parent' or 'kid' (kid object)
    
    const [kids, setKids] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [redeemedRewardsData, setRedeemedRewardsData] = useState([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setCurrentUserId(user.uid);
            } else {
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

    useEffect(() => {
        if (!isAuthReady || !currentUser) {
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        const collectionsToFetch = [
            { path: kidsCollectionPath, setter: setKids, orderByField: "name" },
            { path: tasksCollectionPath, setter: setTasks, orderByField: "createdAt" },
            { path: rewardsCollectionPath, setter: setRewards, orderByField: "createdAt" },
            { path: completedTasksCollectionPath, setter: setCompletedTasks, orderByField: "dateSubmitted" },
            { path: redeemedRewardsCollectionPath, setter: setRedeemedRewardsData, orderByField: "dateRedeemed" },
        ];

        const unsubscribes = collectionsToFetch.map(col => {
            const q = col.orderByField ? query(collection(db, col.path)) : query(collection(db, col.path)); // Removed orderBy for now
            return onSnapshot(q, (snapshot) => {
                const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                col.setter(dataList);
            }, (err) => {
                console.error(`Error fetching ${col.path}:`, err);
                setError(`Failed to load data from ${col.path}.`);
            });
        });
        
        setIsLoading(false); 
        return () => unsubscribes.forEach(unsub => unsub());
    }, [isAuthReady, currentUser]);

    const handleParentAccess = () => {
        setAuthAttempt('parentPin');
        setPinInput('');
        setPinError('');
    };

    const handleKidSelectForPin = (kid) => {
        setSelectedKidForPin(kid);
        setAuthAttempt('kidPin');
        setPinInput('');
        setPinError('');
    };

    const handlePinSubmit = () => {
        setPinError('');
        if (authAttempt === 'parentPin') {
            if (pinInput === PARENT_PIN) {
                setRole('parent');
                setAuthAttempt(null);
            } else {
                setPinError('Incorrect Parent PIN.');
            }
        } else if (authAttempt === 'kidPin' && selectedKidForPin) {
            if (pinInput === selectedKidForPin.pin) {
                setRole(selectedKidForPin); // Set role to the kid object
                setAuthAttempt(null);
                setSelectedKidForPin(null);
            } else {
                setPinError('Incorrect PIN for ' + selectedKidForPin.name + '.');
            }
        }
        setPinInput('');
    };
    
    const handleLogout = () => {
        setRole(null);
        setAuthAttempt(null);
        setSelectedKidForPin(null);
        setPinInput('');
        setPinError('');
    };
    
    if (!isAuthReady) return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold">Initializing App...</div></div>;
    if (isLoading && isAuthReady && currentUser) return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold">Loading Data...</div></div>;
    if (error) return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-xl font-semibold text-red-500 p-4 bg-red-100 rounded-md">{error}</div></div>;

    if (!role) { // Show login/selection screen
        if (authAttempt) { // PIN Entry Screen
            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-4">
                    <Card className="w-full max-w-sm">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
                            Enter PIN for {authAttempt === 'parentPin' ? 'Parent Access' : selectedKidForPin?.name}
                        </h2>
                        <InputField
                            label="PIN"
                            type="password"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            placeholder="Enter 4-digit PIN"
                            maxLength="4"
                        />
                        {pinError && <p className="text-red-500 text-sm mb-3 text-center">{pinError}</p>}
                        <Button onClick={handlePinSubmit} className="w-full bg-green-500 hover:bg-green-600 mb-3" icon={LockKeyhole}>
                            Submit PIN
                        </Button>
                        <Button onClick={() => { setAuthAttempt(null); setPinError(''); }} className="w-full bg-gray-400 hover:bg-gray-500" icon={LogOut}>
                            Back
                        </Button>
                    </Card>
                </div>
            );
        }

        // Initial Role/Kid Selection Screen
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">Kids Chore & Reward</h1>
                    <p className="text-xl text-purple-200">Welcome! Please select your role or profile.</p>
                    {currentUserId && <p className="text-xs text-purple-300 mt-2">App ID: {appId} | User ID: {currentUserId}</p>}
                </div>
                <Card className="w-full max-w-md">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">Who are you?</h2>
                    <Button onClick={handleParentAccess} className="w-full mb-4 bg-indigo-500 hover:bg-indigo-600" icon={ShieldCheck}>
                        I'm a Parent
                    </Button>
                    <hr className="my-4"/>
                    <h3 className="text-lg font-medium text-gray-600 mb-3 text-center">Or, select a Kid Profile:</h3>
                    {kids.length > 0 ? (
                        <div className="space-y-2">
                            {kids.map(kid => (
                                <Button key={kid.id} onClick={() => handleKidSelectForPin(kid)} className="w-full bg-green-500 hover:bg-green-600" icon={User}>
                                    {kid.name}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">No kid profiles available. A parent needs to add them first (and set their PINs).</p>
                    )}
                </Card>
            </div>
        );
    }

    // Main App View (Parent or Kid Dashboard)
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
                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-700">
                            {role === 'parent' ? 'Parent View' : `Kid: ${role?.name}`}
                        </span>
                        <Button onClick={handleLogout} className="bg-gray-500 hover:bg-gray-600" icon={LogOut}>
                            Logout
                        </Button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6">
                {role === 'parent' && <ParentDashboard kids={kids} tasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewards={redeemedRewardsData} />}
                {typeof role === 'object' && role?.id && <KidDashboard kid={role} tasks={tasks} rewards={rewards} completedTasks={completedTasks} redeemedRewards={redeemedRewardsData} />}
            </main>
            <footer className="text-center py-6 text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} Chore Rewards App. App ID: {appId}</p>
            </footer>
        </div>
    );
}

// --- Parent Dashboard ---
const ParentDashboard = ({ kids, tasks, rewards, completedTasks, redeemedRewards }) => {
    const [activeTab, setActiveTab] = useState('kids');
    const pendingTasks = completedTasks.filter(task => task.status === 'pending');

    const renderContent = () => {
        switch (activeTab) {
            case 'kids': return <ManageKids kids={kids} />;
            case 'tasks': return <ManageTasks tasks={tasks} kids={kids} />;
            case 'rewards': return <ManageRewards rewards={rewards} />;
            case 'approve': return <ApproveTasks pendingTasks={pendingTasks} kids={kids} tasks={tasks}/>;
            case 'history': return <ParentRewardHistory redeemedRewards={redeemedRewards} completedTasks={completedTasks} kids={kids} rewards={rewards} tasks={tasks} />;
            default: return <ManageKids kids={kids} />;
        }
    };
    
    const NavItem = ({ tabName, icon: Icon, label, count }) => (
        <button onClick={() => setActiveTab(tabName)} className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-150 ${activeTab === tabName ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-purple-100'}`}>
            <Icon size={20} className="mr-2" /> {label}
            {count > 0 && <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{count}</span>}
        </button>
    );

    return (
        <div className="space-y-6">
            <Card><h2 className="text-3xl font-semibold text-gray-800 mb-2">Parent Dashboard</h2><p className="text-gray-600">Manage chores, rewards, and your kids' progress.</p></Card>
            <nav className="bg-white shadow rounded-lg p-2"><div className="flex flex-wrap gap-2">
                <NavItem tabName="kids" icon={Users} label="Manage Kids" />
                <NavItem tabName="tasks" icon={ClipboardList} label="Manage Tasks" />
                <NavItem tabName="rewards" icon={Trophy} label="Manage Rewards" />
                <NavItem tabName="approve" icon={Bell} label="Approve Tasks" count={pendingTasks.length} />
                <NavItem tabName="history" icon={ListChecks} label="View History" />
            </div></nav>
            <div>{renderContent()}</div>
        </div>
    );
};

// --- Manage Kids (Parent) ---
const ManageKids = ({ kids }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [kidName, setKidName] = useState('');
    const [kidPin, setKidPin] = useState('');
    const [editingKid, setEditingKid] = useState(null); // For editing existing kid
    const [formError, setFormError] = useState('');

    const openAddModal = () => {
        setEditingKid(null);
        setKidName('');
        setKidPin('');
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (kid) => {
        setEditingKid(kid);
        setKidName(kid.name);
        setKidPin(kid.pin || ''); // Use existing PIN or empty
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSaveKid = async () => {
        if (!kidName.trim() || !kidPin.trim() || kidPin.length !== 4 || !/^\d{4}$/.test(kidPin)) {
            setFormError('Kid name is required and PIN must be 4 digits.');
            return;
        }
        setFormError('');
        try {
            if (editingKid) { // Update existing kid
                const kidRef = doc(db, kidsCollectionPath, editingKid.id);
                await updateDoc(kidRef, { name: kidName.trim(), pin: kidPin });
            } else { // Add new kid
                await addDoc(collection(db, kidsCollectionPath), {
                    name: kidName.trim(),
                    pin: kidPin,
                    points: 0,
                    createdAt: Timestamp.now()
                });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving kid: ", error);
            setFormError('Failed to save kid. Please try again.');
        }
    };
    
    // Delete Kid functionality (simplified, no cascading deletes for brevity here)
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [kidToDelete, setKidToDelete] = useState(null);

    const confirmDeleteKid = (kid) => {
        setKidToDelete(kid);
        setShowConfirmDeleteModal(true);
    };
    const handleDeleteKid = async () => {
        if (!kidToDelete) return;
        try {
            // Consider implications: what happens to their completed tasks, redeemed rewards?
            // For simplicity, we just delete the kid. In a real app, might archive or handle dependencies.
            // Advanced: Delete associated data in a batch (as in previous versions)
            await deleteDoc(doc(db, kidsCollectionPath, kidToDelete.id));
        } catch (error) {
            console.error("Error deleting kid: ", error);
        } finally {
            setShowConfirmDeleteModal(false);
            setKidToDelete(null);
        }
    };


    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Kids</h3>
                <Button onClick={openAddModal} className="bg-green-500 hover:bg-green-600" icon={PlusCircle}>Add Kid</Button>
            </div>
            {kids.length === 0 ? <p className="text-gray-500">No kids added yet.</p> : (
                <ul className="space-y-3">
                    {kids.map(kid => (
                        <li key={kid.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm">
                            <div>
                                <span className="font-medium text-lg text-gray-800">{kid.name}</span>
                                <span className="ml-4 text-sm text-purple-600 font-semibold">{kid.points} points</span>
                                <span className="ml-4 text-xs text-gray-500">(PIN: {kid.pin})</span>
                            </div>
                            <div className="flex space-x-2">
                                <Button onClick={() => openEditModal(kid)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm" icon={Edit3}>Edit</Button>
                                <Button onClick={() => confirmDeleteKid(kid)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingKid ? "Edit Kid" : "Add New Kid"}>
                {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
                <InputField label="Kid's Name" value={kidName} onChange={e => setKidName(e.target.value)} placeholder="e.g., Alex" required />
                <InputField label="Kid's 4-Digit PIN" type="text" value={kidPin} onChange={e => setKidPin(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="e.g., 1234" required maxLength="4" />
                <Button onClick={handleSaveKid} className="w-full bg-green-500 hover:bg-green-600">{editingKid ? "Save Changes" : "Add Kid"}</Button>
            </Modal>
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete kid "{kidToDelete?.name}"? This action cannot be undone and might affect task assignments and history.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmDeleteModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteKid} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Manage Tasks (Parent) ---
const ManageTasks = ({ tasks, kids }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [taskName, setTaskName] = useState('');
    const [taskPoints, setTaskPoints] = useState('');
    const [recurrenceType, setRecurrenceType] = useState('none');
    const [assignedKidId, setAssignedKidId] = useState(''); // Empty string for unassigned
    const [formError, setFormError] = useState('');

    const recurrenceOptions = [
        { value: 'none', label: 'None (One-time)' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
    ];
    const kidOptions = [{ value: '', label: 'Unassigned (Any Kid)' }, ...kids.map(k => ({ value: k.id, label: k.name }))];


    const openAddModal = () => {
        setEditingTask(null);
        setTaskName('');
        setTaskPoints('');
        setRecurrenceType('none');
        setAssignedKidId('');
        setFormError('');
        setIsModalOpen(true);
    };
    const openEditModal = (task) => {
        setEditingTask(task);
        setTaskName(task.name);
        setTaskPoints(task.points.toString());
        setRecurrenceType(task.recurrenceType || 'none');
        setAssignedKidId(task.assignedKidId || '');
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSaveTask = async () => {
        if (!taskName.trim() || !taskPoints || isNaN(parseInt(taskPoints)) || parseInt(taskPoints) <= 0) {
            setFormError('Task name and a positive point value are required.');
            return;
        }
        setFormError('');
        const taskData = {
            name: taskName.trim(),
            points: parseInt(taskPoints),
            recurrenceType,
            assignedKidId: assignedKidId || null, // Store null if unassigned
            isActive: true, // New tasks are active by default
            nextDueDate: recurrenceType !== 'none' ? Timestamp.fromDate(getStartOfDay(new Date())) : null, // Set initial nextDueDate for recurring tasks
        };

        try {
            if (editingTask) {
                const taskRef = doc(db, tasksCollectionPath, editingTask.id);
                // If recurrence changed from recurring to none, clear nextDueDate
                if (editingTask.recurrenceType !== 'none' && taskData.recurrenceType === 'none') {
                    taskData.nextDueDate = null;
                } else if (taskData.recurrenceType !== 'none' && (!editingTask.nextDueDate || editingTask.recurrenceType !== taskData.recurrenceType)) {
                    // If it's newly recurring or type changed, set initial nextDueDate
                    taskData.nextDueDate = Timestamp.fromDate(getStartOfDay(new Date()));
                } else if (taskData.recurrenceType !== 'none') {
                    taskData.nextDueDate = editingTask.nextDueDate; // Preserve existing if type didn't change to none
                }

                await updateDoc(taskRef, taskData);
            } else {
                taskData.createdAt = Timestamp.now();
                await addDoc(collection(db, tasksCollectionPath), taskData);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving task: ", error);
            setFormError('Failed to save task. Please try again.');
        }
    };
    
    // Delete Task functionality
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const confirmDeleteTask = (task) => { setTaskToDelete(task); setShowConfirmDeleteModal(true); };
    const handleDeleteTask = async () => {
        if(!taskToDelete) return;
        try { await deleteDoc(doc(db, tasksCollectionPath, taskToDelete.id)); }
        catch (error) { console.error("Error deleting task: ", error); }
        finally { setShowConfirmDeleteModal(false); setTaskToDelete(null); }
    };


    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Tasks</h3>
                <Button onClick={openAddModal} className="bg-teal-500 hover:bg-teal-600" icon={PlusCircle}>Add Task</Button>
            </div>
             {tasks.length === 0 ? <p className="text-gray-500">No tasks defined yet.</p> : (
                <ul className="space-y-3">
                    {tasks.map(task => {
                        const assignedKid = kids.find(k => k.id === task.assignedKidId);
                        return (
                            <li key={task.id} className="p-4 bg-gray-50 rounded-lg shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-medium text-lg text-gray-800">{task.name}</span>
                                        <span className="ml-4 text-sm text-teal-600 font-semibold">{task.points} points</span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Recurrence: <span className="font-medium">{task.recurrenceType || 'None'}</span>
                                            {task.nextDueDate && ` | Next Due: ${task.nextDueDate.toDate().toLocaleDateString()}`}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Assigned to: <span className="font-medium">{assignedKid ? assignedKid.name : 'Any Kid'}</span>
                                        </p>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        <Button onClick={() => openEditModal(task)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm" icon={Edit3}>Edit</Button>
                                        <Button onClick={() => confirmDeleteTask(task)} className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm" icon={Trash2}>Delete</Button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? "Edit Task" : "Add New Task"}>
                {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
                <InputField label="Task Name" value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g., Clean room" required />
                <InputField label="Points" type="number" value={taskPoints} onChange={e => setTaskPoints(e.target.value)} placeholder="e.g., 10" required />
                <SelectField label="Recurrence" value={recurrenceType} onChange={e => setRecurrenceType(e.target.value)} options={recurrenceOptions} />
                <SelectField label="Assign to Kid" value={assignedKidId} onChange={e => setAssignedKidId(e.target.value)} options={kidOptions} placeholder="Unassigned (Any Kid)" />
                <Button onClick={handleSaveTask} className="w-full bg-teal-500 hover:bg-teal-600">{editingTask ? "Save Changes" : "Add Task"}</Button>
            </Modal>
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete task "{taskToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmDeleteModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteTask} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Manage Rewards (Parent) - (Largely unchanged, ensure delete confirmation) ---
const ManageRewards = ({ rewards }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rewardName, setRewardName] = useState('');
    const [rewardCost, setRewardCost] = useState('');
    const [formError, setFormError] = useState('');
    // Editing state (optional, can be added if needed)
    // const [editingReward, setEditingReward] = useState(null); 

    const handleAddReward = async () => {
        setFormError('');
        if (!rewardName.trim() || !rewardCost || isNaN(parseInt(rewardCost)) || parseInt(rewardCost) <= 0) {
            setFormError("Reward name and a positive point cost are required.");
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
            setFormError("Failed to add reward. Please try again.");
        }
    };
    
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [rewardToDelete, setRewardToDelete] = useState(null);
    const confirmDeleteReward = (reward) => { setRewardToDelete(reward); setShowConfirmDeleteModal(true); };
    const handleDeleteReward = async () => {
        if(!rewardToDelete) return;
        try { await deleteDoc(doc(db, rewardsCollectionPath, rewardToDelete.id)); }
        catch (error) { console.error("Error deleting reward: ", error); }
        finally { setShowConfirmDeleteModal(false); setRewardToDelete(null); }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">Rewards</h3>
                <Button onClick={() => {setIsModalOpen(true); setFormError('');}} className="bg-yellow-500 hover:bg-yellow-600" icon={PlusCircle}>Add Reward</Button>
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
            <Modal isOpen={isModalOpen} onClose={() => {setIsModalOpen(false); setFormError('');}} title="Add New Reward">
                {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
                <InputField label="Reward Name" value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="e.g., Extra screen time" required />
                <InputField label="Point Cost" type="number" value={rewardCost} onChange={e => setRewardCost(e.target.value)} placeholder="e.g., 50" required />
                <Button onClick={handleAddReward} className="w-full bg-yellow-500 hover:bg-yellow-600">Add Reward</Button>
            </Modal>
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirm Deletion">
                <p className="mb-4">Are you sure you want to delete reward "{rewardToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirmDeleteModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">Cancel</Button>
                    <Button onClick={handleDeleteReward} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
            </Modal>
        </Card>
    );
};

// --- Approve Tasks (Parent) ---
const ApproveTasks = ({ pendingTasks, kids, tasks }) => {
    const handleApproveTask = async (completedTask) => {
        try {
            const kidRef = doc(db, kidsCollectionPath, completedTask.kidId);
            const completedTaskRef = doc(db, completedTasksCollectionPath, completedTask.id);
            const mainTaskRef = doc(db, tasksCollectionPath, completedTask.taskId);

            const kidDoc = await getDoc(kidRef);
            const mainTaskDoc = await getDoc(mainTaskRef);

            if (!kidDoc.exists()) {
                console.error("Kid document not found for approval"); return;
            }
            if (!mainTaskDoc.exists()) {
                console.error("Main task document not found for approval"); return;
            }

            const currentPoints = kidDoc.data().points || 0;
            const taskData = mainTaskDoc.data();
            const pointsToAward = completedTask.taskPoints || taskData.points; // Use points from completedTask if available (future-proofing)

            const batch = writeBatch(db);
            batch.update(kidRef, { points: currentPoints + pointsToAward });
            batch.update(completedTaskRef, { status: 'approved', dateApproved: Timestamp.now() });
            
            // If the original task was recurring, update its nextDueDate
            if (taskData.recurrenceType && taskData.recurrenceType !== 'none') {
                const newNextDueDate = calculateNextDueDate(taskData);
                if (newNextDueDate) {
                    batch.update(mainTaskRef, { nextDueDate: newNextDueDate });
                }
            }
            await batch.commit();

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
                        // const task = tasks.find(t => t.id === ct.taskId); // ct.taskName should be used
                        if (!kid) return <li key={ct.id} className="text-red-500">Kid data missing for a pending task.</li>;
                        
                        return (
                            <li key={ct.id} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <p className="font-semibold text-lg text-gray-800">{kid.name} completed: <span className="text-blue-600">{ct.taskName}</span></p>
                                    <p className="text-sm text-gray-500">Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()}</p>
                                    <p className="text-sm text-purple-600 font-semibold">Points: {ct.taskPoints}</p>
                                </div>
                                <Button onClick={() => handleApproveTask(ct)} className="bg-green-500 hover:bg-green-600" icon={CheckCircle}>
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

// --- Parent Reward History (Enhanced with filtering) ---
const ParentRewardHistory = ({ redeemedRewards, completedTasks, kids, rewards, tasks }) => {
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', 'week', 'month'

    const now = new Date();
    const filterData = (data, dateField) => {
        if (filterPeriod === 'all') return data;
        return data.filter(item => {
            const itemDate = item[dateField]?.toDate();
            if (!itemDate) return false;
            if (filterPeriod === 'today') return getStartOfDay(itemDate).getTime() === getStartOfDay(now).getTime();
            if (filterPeriod === 'week') return itemDate >= getStartOfWeek(now) && itemDate <= getEndOfWeek(now);
            if (filterPeriod === 'month') return itemDate >= getStartOfMonth(now) && itemDate <= getEndOfMonth(now);
            return true;
        });
    };

    const filteredRedeemed = filterData(redeemedRewards, 'dateRedeemed');
    const filteredCompleted = filterData(completedTasks.filter(ct => ct.status === 'approved'), 'dateApproved');


    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">History</h3>
                <SelectField 
                    value={filterPeriod} 
                    onChange={e => setFilterPeriod(e.target.value)}
                    options={[
                        {value: 'all', label: 'All Time'},
                        {value: 'today', label: 'Today'},
                        {value: 'week', label: 'This Week'},
                        {value: 'month', label: 'This Month'},
                    ]}
                />
            </div>
            
            <div className="mb-8">
                <h4 className="text-xl font-semibold text-gray-600 mb-3">Redeemed Rewards</h4>
                {filteredRedeemed.length === 0 ? <p className="text-gray-500">No rewards redeemed in this period.</p> : (
                    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kid</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRedeemed.sort((a, b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis()).map(rr => {
                                const kid = kids.find(k => k.id === rr.kidId);
                                const reward = rewards.find(r => r.id === rr.rewardId);
                                return (<tr key={rr.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rr.dateRedeemed?.toDate().toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{kid?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reward?.name || rr.rewardName || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rr.pointsSpent}</td>
                                </tr>);
                            })}
                        </tbody>
                    </table></div>
                )}
            </div>

            <div>
                <h4 className="text-xl font-semibold text-gray-600 mb-3">Approved Tasks</h4>
                {filteredCompleted.length === 0 ? <p className="text-gray-500">No tasks approved in this period.</p> : (
                     <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Approved</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kid</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCompleted.sort((a, b) => b.dateApproved.toMillis() - a.dateApproved.toMillis()).map(ct => {
                                const kid = kids.find(k => k.id === ct.kidId);
                                // const task = tasks.find(t => t.id === ct.taskId); // Use ct.taskName
                                return (<tr key={ct.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ct.dateApproved?.toDate().toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{kid?.name || ct.kidName || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ct.taskName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ct.taskPoints}</td>
                                </tr>);
                            })}
                        </tbody>
                    </table></div>
                )}
            </div>
        </Card>
    );
};


// --- Kid Dashboard ---
const KidDashboard = ({ kid, tasks, rewards, completedTasks, redeemedRewards }) => {
    const [activeTab, setActiveTab] = useState('profile'); 
    
    const NavItem = ({ tabName, icon: Icon, label }) => (
        <button onClick={() => setActiveTab(tabName)} className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-150 ${activeTab === tabName ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-green-100'}`}>
            <Icon size={20} className="mr-2" /> {label}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <KidProfile kid={kid} />;
            case 'tasks': return <KidTasksList kid={kid} allTasks={tasks} completedTasks={completedTasks} />;
            case 'rewards': return <KidRewardsList kid={kid} rewards={rewards} />;
            case 'history': return <KidHistory kid={kid} completedTasks={completedTasks} redeemedRewards={redeemedRewards} tasks={tasks} rewards={rewards} />;
            default: return <KidProfile kid={kid} />;
        }
    };

    if (!kid) return <p>Loading kid data...</p>;

    return (
        <div className="space-y-6">
             <Card className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
                <h2 className="text-3xl font-semibold mb-1">Hi, {kid.name}!</h2>
                <p className="text-lg">Ready to earn some points and get awesome rewards?</p>
                <div className="mt-4 text-2xl font-bold">Your Points: <span className="bg-white text-green-600 px-3 py-1 rounded-full shadow">{kid.points}</span></div>
            </Card>
             <nav className="bg-white shadow rounded-lg p-2"><div className="flex flex-wrap gap-2">
                <NavItem tabName="profile" icon={User} label="My Profile" />
                <NavItem tabName="tasks" icon={ClipboardList} label="My Tasks" />
                <NavItem tabName="rewards" icon={Gift} label="Redeem Rewards" />
                <NavItem tabName="history" icon={ListChecks} label="My History" />
            </div></nav>
            <div>{renderContent()}</div>
        </div>
    );
};

// --- Kid Profile (Unchanged) ---
const KidProfile = ({ kid }) => (
    <Card>
        <h3 className="text-2xl font-semibold text-gray-700 mb-4">My Profile</h3>
        <p className="text-lg"><strong>Name:</strong> {kid.name}</p>
        <p className="text-lg"><strong>Current Points:</strong> <span className="font-bold text-purple-600">{kid.points}</span></p>
    </Card>
);

// --- Kid Tasks List (Enhanced for daily/weekly view and assignments) ---
const KidTasksList = ({ kid, allTasks, completedTasks }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');
    const [taskViewPeriod, setTaskViewPeriod] = useState('today'); // 'today', 'week'

    const now = new Date();
    const todayStart = getStartOfDay(now);
    const todayEnd = getEndOfDay(now);
    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfWeek(now);

    const isTaskDueInPeriod = (task) => {
        if (!task.isActive) return false;
        // Check assignment
        if (task.assignedKidId && task.assignedKidId !== kid.id) return false;

        const nextDueDate = task.nextDueDate?.toDate();
        if (task.recurrenceType === 'none') { // One-time tasks
            // Show if not completed yet, regardless of period (for simplicity, or add more complex logic)
            const alreadyCompleted = completedTasks.find(ct => ct.taskId === task.id && ct.kidId === kid.id && ct.status === 'approved');
            return !alreadyCompleted;
        }
        if (!nextDueDate) return false; // Recurring tasks must have a next due date

        if (taskViewPeriod === 'today') return nextDueDate >= todayStart && nextDueDate <= todayEnd;
        if (taskViewPeriod === 'week') return nextDueDate >= weekStart && nextDueDate <= weekEnd;
        return false;
    };
    
    const tasksToShow = allTasks.filter(isTaskDueInPeriod);

    const handleCompleteTask = async (task) => {
        const todayStr = new Date().toLocaleDateString();
        const alreadySubmittedTodayForThisInstance = completedTasks.find(ct => 
            ct.taskId === task.id && 
            ct.kidId === kid.id &&
            ct.status === 'pending' && // Only check pending for re-submission prevention
            ct.taskDueDate?.toDate().toLocaleDateString() === task.nextDueDate?.toDate().toLocaleDateString()
        );

        if (alreadySubmittedTodayForThisInstance) {
            setShowFeedback(`You've already submitted "${task.name}" for this due date. It's pending approval.`);
            setFeedbackType('info');
            setTimeout(() => setShowFeedback(''), 4000);
            return;
        }

        try {
            await addDoc(collection(db, completedTasksCollectionPath), {
                kidId: kid.id,
                kidName: kid.name,
                taskId: task.id,
                taskName: task.name,
                taskPoints: task.points,
                taskDueDate: task.nextDueDate || Timestamp.fromDate(todayStart), // Due date of this specific instance
                dateSubmitted: Timestamp.now(),
                status: 'pending'
            });
            setShowFeedback(`Task "${task.name}" submitted for approval!`);
            setFeedbackType('success');
            setTimeout(() => setShowFeedback(''), 3000);
            // Note: The parent's approval will trigger updating the main task's nextDueDate
        } catch (error) {
            console.error("Error completing task: ", error);
            setShowFeedback('Error submitting task. Please try again.');
            setFeedbackType('error');
            setTimeout(() => setShowFeedback(''), 3000);
        }
    };
    
    const feedbackColor = { info: 'bg-blue-100 text-blue-700', success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">My Tasks</h3>
                 <SelectField 
                    value={taskViewPeriod} 
                    onChange={e => setTaskViewPeriod(e.target.value)}
                    options={[
                        {value: 'today', label: "Today's Tasks"},
                        {value: 'week', label: "This Week's Tasks"},
                    ]}
                />
            </div>
            {showFeedback && <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>{showFeedback}</p>}
            
            {tasksToShow.length === 0 ? <p className="text-gray-500">No tasks due for this period, or check if tasks are assigned to you.</p> : (
                <ul className="space-y-4">
                    {tasksToShow.map(task => {
                        const isCompletedInstancePending = completedTasks.find(ct => 
                            ct.taskId === task.id && 
                            ct.kidId === kid.id &&
                            ct.status === 'pending' &&
                            ct.taskDueDate?.toDate().getTime() === task.nextDueDate?.toDate().getTime()
                        );
                         const isCompletedInstanceApproved = completedTasks.find(ct => 
                            ct.taskId === task.id && 
                            ct.kidId === kid.id &&
                            ct.status === 'approved' &&
                            ct.taskDueDate?.toDate().getTime() === task.nextDueDate?.toDate().getTime()
                        );


                        let buttonOrStatus;
                        if (isCompletedInstanceApproved) {
                            buttonOrStatus = <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">Completed & Approved</span>;
                        } else if (isCompletedInstancePending) {
                            buttonOrStatus = <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800">Pending Approval</span>;
                        } else {
                            buttonOrStatus = <Button onClick={() => handleCompleteTask(task)} className="bg-blue-500 hover:bg-blue-600" icon={CheckCircle}>I Did This!</Button>;
                        }

                        return (
                            <li key={task.id + (task.nextDueDate?.seconds || '')} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <span className="font-semibold text-lg text-gray-800">{task.name}</span>
                                    <p className="text-sm text-purple-600 font-semibold">{task.points} points</p>
                                    {task.nextDueDate && <p className="text-xs text-gray-500">Due: {task.nextDueDate.toDate().toLocaleDateString()}</p>}
                                </div>
                                {buttonOrStatus}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};

// --- Kid Rewards List (Unchanged, ensure delete confirmation if editing is added) ---
const KidRewardsList = ({ kid, rewards }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info');

    const handleRedeemReward = async (reward) => {
        if (kid.points < reward.pointCost) {
            setShowFeedback("Not enough points to redeem this reward.");
            setFeedbackType('error'); setTimeout(() => setShowFeedback(''), 3000); return;
        }
        try {
            const kidRef = doc(db, kidsCollectionPath, kid.id);
            const batch = writeBatch(db);
            batch.update(kidRef, { points: kid.points - reward.pointCost });
            const newRedeemedRewardRef = doc(collection(db, redeemedRewardsCollectionPath));
            batch.set(newRedeemedRewardRef, { 
                kidId: kid.id, kidName: kid.name, rewardId: reward.id,
                rewardName: reward.name, pointsSpent: reward.pointCost, dateRedeemed: Timestamp.now()
            });
            await batch.commit();
            setShowFeedback(`Reward "${reward.name}" redeemed successfully!`);
            setFeedbackType('success'); setTimeout(() => setShowFeedback(''), 3000);
        } catch (error) {
            console.error("Error redeeming reward: ", error);
            setShowFeedback('Error redeeming reward. Please try again.');
            setFeedbackType('error'); setTimeout(() => setShowFeedback(''), 3000);
        }
    };
    
    const availableRewards = rewards.filter(reward => reward.isAvailable);
    const feedbackColor = { info: 'bg-blue-100 text-blue-700', success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };

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
                            <Button onClick={() => handleRedeemReward(reward)} disabled={kid.points < reward.pointCost}
                                className={`w-full ${kid.points < reward.pointCost ? 'bg-gray-400' : 'bg-yellow-500 hover:bg-yellow-600'}`} icon={DollarSign}>
                                {kid.points < reward.pointCost ? 'Not Enough Points' : 'Redeem'}
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </Card>
    );
};

// --- Kid History (Enhanced with filtering) ---
const KidHistory = ({ kid, completedTasks, redeemedRewards, tasks, rewards }) => {
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', 'week', 'month'
    const now = new Date();

    const filterData = (data, dateField) => {
        if (filterPeriod === 'all') return data;
        return data.filter(item => {
            const itemDate = item[dateField]?.toDate();
            if (!itemDate) return false;
            if (filterPeriod === 'today') return getStartOfDay(itemDate).getTime() === getStartOfDay(now).getTime();
            if (filterPeriod === 'week') return itemDate >= getStartOfWeek(now) && itemDate <= getEndOfWeek(now);
            if (filterPeriod === 'month') return itemDate >= getStartOfMonth(now) && itemDate <= getEndOfMonth(now);
            return true;
        });
    };
    
    // Filter for the specific kid
    const kidCompletedTasks = completedTasks.filter(ct => ct.kidId === kid.id);
    const kidRedeemedRewards = redeemedRewards.filter(rr => rr.kidId === kid.id);

    const filteredCompleted = filterData(kidCompletedTasks, 'dateSubmitted'); // or dateApproved if preferred for "done"
    const filteredRedeemed = filterData(kidRedeemedRewards, 'dateRedeemed');

    return (
        <div className="space-y-8">
            <div className="flex justify-end mb-0 -mt-4"> {/* Position filter for kid history */}
                 <SelectField 
                    value={filterPeriod} 
                    onChange={e => setFilterPeriod(e.target.value)}
                    options={[
                        {value: 'all', label: 'All Time'},
                        {value: 'today', label: 'Today'},
                        {value: 'week', label: 'This Week'},
                        {value: 'month', label: 'This Month'},
                    ]}
                />
            </div>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Completed Tasks</h3>
                {filteredCompleted.length === 0 ? <p className="text-gray-500">You haven't completed tasks in this period.</p> : (
                     <ul className="space-y-3">
                        {filteredCompleted.sort((a,b) => b.dateSubmitted.toMillis() - a.dateSubmitted.toMillis()).map(ct => (
                            <li key={ct.id} className="p-3 bg-gray-50 rounded-lg shadow-sm">
                                <p className="font-medium text-gray-800">{ct.taskName}</p>
                                <p className="text-sm text-gray-500">
                                    Submitted: {ct.dateSubmitted?.toDate().toLocaleDateString()} - 
                                    Status: <span className={`font-semibold ${ct.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{ct.status}</span>
                                    {ct.status === 'approved' && ` (+${ct.taskPoints} pts)`}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Redeemed Rewards</h3>
                {filteredRedeemed.length === 0 ? <p className="text-gray-500">You haven't redeemed rewards in this period.</p> : (
                    <ul className="space-y-3">
                        {filteredRedeemed.sort((a,b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis()).map(rr => (
                            <li key={rr.id} className="p-3 bg-gray-50 rounded-lg shadow-sm">
                                <p className="font-medium text-gray-800">{rr.rewardName}</p>
                                <p className="text-sm text-gray-500">Redeemed: {rr.dateRedeemed?.toDate().toLocaleDateString()} for {rr.pointsSpent} points</p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default App;
