# First-Time Password Change Implementation

## Overview

Implemented a mandatory password change feature on first login for recruiters and team leaders. When a recruiter/team leader logs in for the first time, they are presented with a modal to change their temporary password before accessing the dashboard.

## Changes Made

### 1. Database Schema Migration

**File**: `schema.sql`

- Added new column to track password changes:
  ```sql
  ALTER TABLE recruiter
    ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT FALSE;
  ```
- This column tracks whether the recruiter has changed their temporary password
- Defaults to `FALSE` for new recruiters (whose passwords are set by admin)
- Set to `TRUE` after the recruiter successfully changes their password

### 2. Backend - Login Endpoint Update

**File**: `src/routes/recruiterRoutes.js`

- **Updated POST `/api/recruiters/login`** endpoint to:
  - Read the `password_changed` column from the database
  - Include `passwordChanged` boolean in the login response
  - Returns `false` for first-time login, `true` if password already changed

### 3. Backend - Password Change Endpoint

**File**: `src/routes/recruiterRoutes.js`

- **New POST `/api/recruiters/:rid/change-password`** endpoint
  - Requires authentication (`requireAuth` middleware)
  - Requires recruiter to own the resource (`requireRecruiterOwner` middleware)
  - Accepts `newPassword` in request body (minimum 6 characters)
  - Optionally accepts `oldPassword` for verification
  - Updates the password and sets `password_changed = TRUE`
  - Returns success/error messages

### 4. Frontend - Password Change Modal Component

**File**: `src/components/PasswordChangeModal.jsx`

- New React component for handling password changes
- Features:
  - Modal overlay with semi-transparent background
  - Personalized greeting with recruiter's name
  - New password and confirm password fields
  - Show/hide password toggles
  - Password validation (minimum 6 characters, must match confirm)
  - Success/error message display
  - Auto-closes after successful password change
  - Beautiful fade-in animation

### 5. Frontend - Modal Styles

**File**: `src/styles/password-change-modal.css`

- Professional styling for the password change modal
- Responsive design for mobile devices
- Smooth animations and transitions
- Clear visual feedback for input fields and messages
- Color-coded messages (success: green, error: red)

### 6. Frontend - RecruiterLogin Component Update

**File**: `src/pages/RecruiterLogin.jsx`

- Imported `PasswordChangeModal` component
- Added `showPasswordChangeModal` state to control modal visibility
- Updated `handleLoginSubmit()` to:
  - Check if `recruiter.passwordChanged === false`
  - Show the modal if first-time login
- Added modal rendering in JSX:
  ```jsx
  {
    recruiter && (
      <PasswordChangeModal
        isOpen={showPasswordChangeModal}
        onClose={() => setShowPasswordChangeModal(false)}
        recruiterName={recruiter.name}
        recruiterId={recruiter.rid}
      />
    );
  }
  ```

## User Flow

1. **Admin creates recruiter** with temporary password
   - `password_changed` column is `FALSE`
   - User cannot access dashboard until password is changed

2. **Recruiter's first login**
   - Login credentials accepted
   - Backend returns `passwordChanged: false` in response
   - Modal automatically displays on the page
   - Recruiter cannot access dashboard until password is changed

3. **Recruiter changes password**
   - Enters new password (minimum 6 characters)
   - Confirms password by typing it again
   - Submits form
   - Backend validates and updates password
   - Sets `password_changed = TRUE`
   - Modal shows success message and closes after 2 seconds
   - Recruiter can now fully access the dashboard

4. **Subsequent logins**
   - `passwordChanged: true` returned from login
   - Modal does not display
   - Recruiter goes directly to dashboard
   - Recruiter can change password anytime via profile settings if needed

## Security Considerations

- Password change endpoint requires authentication (`requireAuth`)
- Password change endpoint requires recruiter ownership (`requireRecruiterOwner`)
- Passwords are minimum 6 characters (enforce stronger requirements if needed)
- Modal prevents access to dashboard until password is changed
- Modal cannot be closed/dismissed - only way out is to change password or refresh

## Installation & Deployment

1. **Run database migration**:

   ```sql
   USE your_database;
   -- Run the updated schema.sql file or execute:
   ALTER TABLE recruiter
     ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT FALSE;
   ```

2. **Mark existing recruiters' passwords as changed** (if they already have custom passwords):

   ```sql
   UPDATE recruiter SET password_changed = TRUE;
   ```

3. **Restart backend server** for new endpoint to take effect

4. **Rebuild frontend** to include new component and styles:
   ```bash
   npm run build
   ```

## Testing Checklist

- [ ] Create a new recruiter with temporary password via admin panel
- [ ] Login with temporary password - modal should appear
- [ ] Try submitting empty password - should show error
- [ ] Try password shorter than 6 characters - should show error
- [ ] Try mismatched passwords - should show error
- [ ] Enter valid new password and confirm - should succeed and close modal
- [ ] Login again with new password - modal should NOT appear
- [ ] Verify dashboard is accessible after password change
- [ ] Test on mobile devices - modal should be responsive
- [ ] Test password toggle visibility buttons work correctly
