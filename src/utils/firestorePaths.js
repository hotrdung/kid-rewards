// src/utils/firestorePaths.js
import { CURRENT_APP_ID } from '../constants/appConstants';

export const getGlobalCollectionPath = (collectionName) => `/artifacts/${CURRENT_APP_ID}/${collectionName}`;
export const getFamilyScopedCollectionPath = (familyId, collectionName) => `/artifacts/${CURRENT_APP_ID}/families/${familyId}/${collectionName}`;
export const getOldPublicDataCollectionPath = (collectionName) => `/artifacts/${CURRENT_APP_ID}/public/data/${collectionName}`;

export const usersCollectionPath = getGlobalCollectionPath('users');
export const familiesCollectionPath = getGlobalCollectionPath('families');
export const highscoreGroupsCollectionPath = getGlobalCollectionPath('highscoreGroups');
