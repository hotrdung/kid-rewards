// src/services/dataMigration.js
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getOldPublicDataCollectionPath, getFamilyScopedCollectionPath } from '../utils/firestorePaths';

export const migrateDataToFamily = async (familyId, saUserId, saDisplayName, reportErrorFunc) => {
    console.log(`Starting data migration to family ${familyId} for SA ${saUserId}`);
    const collectionsToMigrate = ['kids', 'tasks', 'rewards', 'completedTasks', 'redeemedRewards'];
    let success = true;
    for (const collectionName of collectionsToMigrate) {
        const oldPath = getOldPublicDataCollectionPath(collectionName);
        const newBasePath = getFamilyScopedCollectionPath(familyId, collectionName);
        try {
            const oldDocsSnap = await getDocs(collection(db, oldPath));
            if (oldDocsSnap.empty) {
                console.log(`No documents found in old path: ${oldPath}. Skipping migration for this collection.`);
                continue;
            }
            console.log(`Migrating ${oldDocsSnap.size} documents from ${oldPath} to ${newBasePath}`);
            const batch = writeBatch(db);
            oldDocsSnap.docs.forEach(oldDoc => {
                const newDocRef = doc(collection(db, newBasePath)); // Auto-generate ID
                let dataToMigrate = oldDoc.data();
                if (collectionName === 'kids') {
                    dataToMigrate.familyId = familyId;
                    dataToMigrate.totalEarnedPoints = dataToMigrate.totalEarnedPoints || 0;
                }
                batch.set(newDocRef, dataToMigrate);
            });
            await batch.commit();
            console.log(`Successfully migrated ${collectionName} to family ${familyId}.`);
        } catch (error) {
            console.error(`Error migrating collection ${collectionName} from ${oldPath}:`, error);
            if (reportErrorFunc) {
                reportErrorFunc(`Migration error for ${collectionName}: ${error.message}`);
            }
            success = false;
        }
    }
    return success;
};
