#!/bin/bash

# Create base directories
mkdir -p src/assets
mkdir -p src/components/common
mkdir -p src/components/admin
mkdir -p src/components/parent
mkdir -p src/components/kid
mkdir -p src/config
mkdir -p src/constants
mkdir -p src/hooks
mkdir -p src/services
mkdir -p src/utils
mkdir -p src/styles

# Create top-level files (or update timestamp if they exist)
# These are standard CRA files or your main App file that will be refactored.
touch src/App.js
touch src/App.test.js
touch src/index.js
touch src/index.css
touch src/setupTests.js
touch src/reportWebVitals.js

# Create files in components/common
touch src/components/common/Button.js
touch src/components/common/Card.js
touch src/components/common/ConfirmationModal.js
touch src/components/common/DayOfWeekSelector.js
touch src/components/common/InputField.js
touch src/components/common/Modal.js
touch src/components/common/NavItemButton.js
touch src/components/common/SelectField.js
touch src/components/common/StarIconDisplay.js
touch src/components/common/TextAreaField.js

# Create files in components/admin
touch src/components/admin/AdminSection.js
touch src/components/admin/ManageFamilies.js
touch src/components/admin/ManageFamilyParents.js
touch src/components/admin/ManageHighscoreGroups.js

# Create files in components/parent
touch src/components/parent/ParentDashboard.js
touch src/components/parent/ManageKids.js
touch src/components/parent/ManageTasks.js
touch src/components/parent/ManageRewards.js
touch src/components/parent/ApproveTasks.js
touch src/components/parent/FulfillRewards.js
touch src/components/parent/ParentRewardHistory.js

# Create files in components/kid
touch src/components/kid/KidDashboard.js
touch src/components/kid/KidProfile.js
touch src/components/kid/KidTasksList.js
touch src/components/kid/KidRewardsList.js
touch src/components/kid/KidHistory.js
touch src/components/kid/KidHighscores.js

# Create files in config
touch src/config/firebase.js

# Create files in constants
touch src/constants/appConstants.js
touch src/constants/dateTime.js

# Create files in hooks
touch src/hooks/useAuth.js
touch src/hooks/useAppData.js

# Create files in services
touch src/services/dataMigration.js

# Create files in utils
touch src/utils/dateHelpers.js
touch src/utils/firestorePaths.js

echo "Folder structure and empty files created successfully!"
