# **Deployment Guide for React & Firebase Rewards App**

This guide provides a comprehensive walkthrough for deploying the "Kid Rewards" React application, which uses Firebase for its backend services (Authentication and Firestore).

## **1\. Prerequisites**

* **Node.js and npm:** Ensure you have Node.js (which includes npm) installed on your local machine. You can download it from [nodejs.org](https://nodejs.org/).  
* **Git:** You'll need Git for version control and deploying to hosting services.  
* **Firebase Account:** A Google account is required to create and manage Firebase projects.  
* **GitHub Account:** Required for version control and setting up CI/CD.

## **2\. Firebase Project Setup**

### **Step 2.1: Create a New Firebase Project**

1. Go to the [Firebase Console](https://console.firebase.google.com/).  
2. Click on **"Add project"**.  
3. Give your project a name (e.g., kid-rewards-app).  
4. Follow the on-screen steps to create the project. You can choose whether or not to enable Google Analytics.

### **Step 2.2: Register Your Web App**

1. Inside your new project in the Firebase Console, click the web icon (\</\>) to add a new web app.  
2. Give your app a nickname (e.g., "Kid Rewards Web").  
3. Click **"Register app"**.  
4. Firebase will provide you with a firebaseConfig object. **Copy these values.** You will need them for your local development environment.

### **Step 2.3: Set up Firebase Authentication**

The application uses Google Sign-In and Anonymous Authentication.

1. In the Firebase Console, go to **Build \> Authentication**.  
2. Click on the **"Get started"** button.  
3. In the **"Sign-in method"** tab, you need to enable the following providers:  
   * **Google:** Click on "Google", enable it, provide a project support email, and save.  
   * **Anonymous:** Click on "Anonymous", enable it, and save.

### **Step 2.4: Set up Cloud Firestore (Database)**

1. In the Firebase Console, go to **Build \> Firestore Database**.  
2. Click **"Create database"**.  
3. Start in **production mode**. This ensures your data is not publicly accessible by default.  
4. Choose a location for your Firestore data (choose the one closest to your users).  
5. Click **"Enable"**.

#### **Firestore Security Rules**

You need to set up security rules to control access to your data.

1. Navigate to the **Rules** tab within the Firestore Database section.  
2. Replace the default rules with the following to allow authenticated users to read and write their own data. The application's code structure implies a multi-tenant setup under an artifacts collection.

rules\_version \= '2';

service cloud.firestore {  
  match /databases/{database}/documents {

    // Global Collections (Users, Families, etc.)  
    match /artifacts/{appId}/{collection}/{docId} {  
      // Allow authenticated users to read/write.  
      // You should refine this for more granular control.  
      // For example, users should only be ableto write to their own user doc.  
      allow read, write: if request.auth \!= null;  
    }

    // Family-scoped sub-collections (kids, tasks, etc.)  
    match /artifacts/{appId}/families/{familyId}/{collection}/{docId} {  
      // Allow read/write if the user is authenticated.  
      // For production, you would verify if the user belongs to the {familyId}.  
      allow read, write: if request.auth \!= null;  
    }  
  }  
}

**Note:** These rules are a starting point. For a production environment, you should implement more granular rules to ensure users can only access data relevant to their family and role.

## **3\. Local Environment Setup**

1. **Clone your repository:**  
   git clone \<your-repository-url\>  
   cd \<your-repository-directory\>

2. **Install dependencies:**  
   npm install

3. **Create a .env file:** In the root of your project, create a file named .env. This file will store your environment variables. The App.js code uses process.env variables for configuration.  
4. **Populate the .env file:** Add the Firebase configuration you copied earlier and other necessary variables.  
   \# Firebase Configuration  
   REACT\_APP\_FIREBASE\_API\_KEY=your\_api\_key  
   REACT\_APP\_FIREBASE\_AUTH\_DOMAIN=your\_auth\_domain  
   REACT\_APP\_FIREBASE\_PROJECT\_ID=your\_project\_id  
   REACT\_APP\_FIREBASE\_STORAGE\_BUCKET=your\_storage\_bucket  
   REACT\_APP\_FIREBASE\_MESSAGING\_SENDER\_ID=your\_messaging\_sender\_id  
   REACT\_APP\_FIREBASE\_APP\_ID=your\_app\_id

   \# Application Specific Configuration  
   REACT\_APP\_CHORE\_APP\_ID=kid-rewards-app-multifamily-v3  
   REACT\_APP\_SA\_EMAILS=your-admin-email@example.com,another-admin@example.com

   * REACT\_APP\_SA\_EMAILS: A comma-separated list of emails for users who should have System Admin (SA) privileges.

## **4\. Deployment**

You can deploy this React app to any static web hosting service. Firebase Hosting is a convenient choice.

### **Step 4.1: Install Firebase CLI**

If you don't have it, install the Firebase Command Line Interface globally:

npm install \-g firebase-tools

### **Step 4.2: Login and Initialize Firebase**

1. Log in to Firebase from the command line:  
   firebase login

2. Initialize Firebase in your project directory:  
   firebase init hosting

3. Follow the prompts:  
   * **Select a project:** Choose "Use an existing project" and select the Firebase project you created.  
   * **Public directory:** Enter build. This is where Create React App places the production assets.  
   * **Configure as a single-page app:** Answer **Yes** (y). This is crucial for React Router to work correctly.  
   * **Set up automatic builds and deploys with GitHub?** You can say **No** for now, as we will configure this manually.

### **Step 4.3: Build and Deploy**

1. **Build the React App:** Create a production-ready build of your app.  
   npm run build

2. **Deploy to Firebase Hosting:**  
   firebase deploy

   After deployment, the CLI will give you the URL where your app is live.

## **5\. GitHub CI/CD Setup**

Automating deployment with GitHub Actions is highly recommended.

### **Step 5.1: Add Firebase Token to GitHub Secrets**

1. Generate a new CI token from Firebase:  
   firebase login:ci

   This will open a browser window. After you log in, a token will be printed in your terminal. Copy this token.  
2. Go to your GitHub repository and navigate to **Settings \> Secrets and variables \> Actions**.  
3. Click **"New repository secret"**.  
   * **Name:** FIREBASE\_TOKEN  
   * **Value:** Paste the token you generated.

### **Step 5.2: Add Environment Variables to GitHub Secrets**

You need to add all the variables from your .env file as secrets so the CI/CD pipeline can use them during the build process.

Repeat the "New repository secret" process for each variable:

* REACT\_APP\_FIREBASE\_API\_KEY  
* REACT\_APP\_FIREBASE\_AUTH\_DOMAIN  
* REACT\_APP\_FIREBASE\_PROJECT\_ID  
* REACT\_APP\_SA\_EMAILS  
* *(and all other REACT\_APP\_ variables)*

### **Step 5.3: Create the GitHub Actions Workflow**

1. In your project's root, create a directory path .github/workflows/.  
2. Inside that directory, create a new file named deploy.yml.  
3. Add the following workflow configuration to deploy.yml:

name: Build and Deploy to Firebase Hosting

on:  
  push:  
    branches:  
      \- main  \# Or your primary branch

jobs:  
  build\_and\_deploy:  
    runs-on: ubuntu-latest  
    steps:  
      \- name: Checkout repository  
        uses: actions/checkout@v3

      \- name: Set up Node.js  
        uses: actions/setup-node@v3  
        with:  
          node-version: '18' \# Specify your Node.js version

      \- name: Install dependencies  
        run: npm install

      \- name: Build production app  
        run: npm run build  
        env:  
          REACT\_APP\_FIREBASE\_API\_KEY: ${{ secrets.REACT\_APP\_FIREBASE\_API\_KEY }}  
          REACT\_APP\_FIREBASE\_AUTH\_DOMAIN: ${{ secrets.REACT\_APP\_FIREBASE\_AUTH\_DOMAIN }}  
          REACT\_APP\_FIREBASE\_PROJECT\_ID: ${{ secrets.REACT\_APP\_FIREBASE\_PROJECT\_ID }}  
          REACT\_APP\_FIREBASE\_STORAGE\_BUCKET: ${{ secrets.REACT\_APP\_FIREBASE\_STORAGE\_BUCKET }}  
          REACT\_APP\_FIREBASE\_MESSAGING\_SENDER\_ID: ${{ secrets.REACT\_APP\_FIREBASE\_MESSAGING\_SENDER\_ID }}  
          REACT\_APP\_FIREBASE\_APP\_ID: ${{ secrets.REACT\_APP\_FIREBASE\_APP\_ID }}  
          REACT\_APP\_CHORE\_APP\_ID: ${{ secrets.REACT\_APP\_CHORE\_APP\_ID }}  
          REACT\_APP\_SA\_EMAILS: ${{ secrets.REACT\_APP\_SA\_EMAILS }}

      \- name: Deploy to Firebase Hosting  
        uses: FirebaseExtended/action-hosting-deploy@v0  
        with:  
          repoToken: '${{ secrets.GITHUB\_TOKEN }}'  
          firebaseServiceAccount: '${{ secrets.FIREBASE\_SERVICE\_ACCOUNT\_KID\_REWARDS\_APP }}' \# Or use FIREBASE\_TOKEN  
          channelId: live  
          projectId: your-project-id \# Replace with your Firebase Project ID  
        env:  
          FIREBASE\_CLI\_PREVIEWS: hostingchannels  
          \# If using token instead of service account:  
          \# FIREBASE\_TOKEN: ${{ secrets.FIREBASE\_TOKEN }}

**Note on firebaseServiceAccount vs FIREBASE\_TOKEN:** The example uses firebaseServiceAccount which is the more modern and secure way. You can generate a service account key from your Firebase project settings (Project settings \> Service accounts) and add the JSON content as a GitHub secret. If you stick with the FIREBASE\_TOKEN, uncomment that line and remove the firebaseServiceAccount line.

### **Step 5.4: Commit and Push**

Commit the deploy.yml file and push it to your main branch. This will trigger the GitHub Action, which will automatically build and deploy your application to Firebase Hosting.

You can view the progress of the action in the "Actions" tab of your GitHub repository.