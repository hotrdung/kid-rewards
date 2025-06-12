// src/constants/appConstants.js
/* global __app_id */

export const CURRENT_APP_ID = typeof __app_id !== 'undefined'
    ? __app_id
    : (process.env.REACT_APP_CHORE_APP_ID || 'kid-rewards-app-multifamily-v3');

const SA_EMAILS_STR = process.env.REACT_APP_SA_EMAILS || "";
export const SYSTEM_ADMIN_EMAILS = SA_EMAILS_STR.split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email);
