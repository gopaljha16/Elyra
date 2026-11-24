# Requirements Document

## Introduction

The Elyra Onboarding Flow is a premium 4-step user onboarding experience for the Elyra dating application. The system guides new users through profile creation, photo uploads, and live face verification to ensure authentic user profiles and enhance trust within the platform. The onboarding flow integrates with existing Clerk authentication, Supabase storage for photos, and Gemini Vision API for face verification.

## Glossary

- **Onboarding_System**: The complete 4-step user onboarding flow including welcome, profile form, photo upload, and face verification
- **Profile_Form**: Multi-step form collecting basic info, interests, personality traits, and matching preferences
- **Photo_Upload_Module**: Component handling profile photo uploads to Supabase storage
- **Face_Verification_Module**: Component performing live face verification using face-api.js and Gemini Vision API
- **Frontend_Client**: Next.js application in elyra-fe folder
- **Backend_API**: Node.js/Express application in elyra-be folder with Prisma ORM
- **Gemini_Vision_API**: Google's Gemini Vision API used for face verification and liveness detection
- **Face_API_JS**: JavaScript library for client-side face detection providing immediate UX feedback
- **Supabase_Storage**: Cloud storage service for storing user profile photos
- **Clerk_Auth**: Authentication provider already integrated in the application
- **User_Profile**: Database record containing user information, photos, and verification status
- **Verification_Log**: Audit trail record of verification attempts and results
- **Session_State**: Temporary storage of onboarding progress during the flow
- **Rate_Limiter**: Mechanism to prevent abuse of verification API calls
- **Liveness_Detection**: Process to verify that a photo is of a live person, not a static image or video

## Requirements

### Requirement 1: Welcome Screen Display

**User Story:** As a new user, I want to see a branded welcome screen, so that I understand what the onboarding process entails.

#### Acceptance Criteria

1. WHEN an authenticated user without a completed profile accesses the application, THE Frontend_Client SHALL display the welcome screen
2. THE Frontend_Client SHALL display the Elyra branding, logo, and tagline on the welcome screen
3. THE Frontend_Client SHALL display an overview of the 4 onboarding steps on the welcome screen
4. WHEN the user clicks the start button, THE Frontend_Client SHALL navigate to step 1 of the Profile_Form
5. THE Frontend_Client SHALL display a progress indicator showing 4 total steps

### Requirement 2: Multi-Step Profile Form Navigation

**User Story:** As a new user, I want to complete my profile through a multi-step form, so that I can provide my information without feeling overwhelmed.

#### Acceptance Criteria

1. THE Profile_Form SHALL consist of exactly 4 sequential steps: Basic Info, Interests, Personality, and Preferences
2. WHEN the user completes a form step, THE Frontend_Client SHALL validate all required fields before allowing progression
3. WHEN the user clicks next on a valid form step, THE Frontend_Client SHALL save the step data to Session_State and navigate to the next step
4. WHEN the user clicks back on any step after step 1, THE Frontend_Client SHALL navigate to the previous step while preserving entered data
5. THE Frontend_Client SHALL display a progress indicator showing current step number and total steps
6. WHEN the user navigates between steps, THE Frontend_Client SHALL restore previously entered data from Session_State

### Requirement 3: Basic Info Collection

**User Story:** As a new user, I want to provide my basic information, so that other users can learn about me.

#### Acceptance Criteria

1. THE Profile_Form SHALL collect name as a required text field with minimum 2 characters and maximum 50 characters
2. THE Profile_Form SHALL collect age as a required number field with minimum value 18 and maximum value 100
3. THE Profile_Form SHALL collect gender as a required selection from predefined options
4. THE Profile_Form SHALL collect location as a required text field
5. THE Profile_Form SHALL collect bio as an optional text field with maximum 500 characters
6. WHEN any required field is empty or invalid, THE Frontend_Client SHALL display field-specific error messages
7. WHEN all required fields are valid, THE Frontend_Client SHALL enable the next button

### Requirement 4: Interests Collection

**User Story:** As a new user, I want to select my interests, so that I can be matched with compatible people.

#### Acceptance Criteria

1. THE Profile_Form SHALL display a list of predefined interest categories
2. THE Profile_Form SHALL allow selection of minimum 3 interests and maximum 10 interests
3. WHEN the user selects an interest, THE Frontend_Client SHALL provide visual feedback indicating selection
4. WHEN the user has selected fewer than 3 interests, THE Frontend_Client SHALL display a message indicating minimum requirement
5. WHEN the user has selected more than 10 interests, THE Frontend_Client SHALL prevent additional selections
6. WHEN the user has selected between 3 and 10 interests, THE Frontend_Client SHALL enable the next button

### Requirement 5: Personality Assessment

**User Story:** As a new user, I want to answer personality questions, so that the system can better understand my character.

#### Acceptance Criteria

1. THE Profile_Form SHALL display a set of personality assessment questions
2. THE Profile_Form SHALL require answers to all personality questions before progression
3. THE Frontend_Client SHALL store personality answers in JSON format in Session_State
4. WHEN all personality questions are answered, THE Frontend_Client SHALL enable the next button

### Requirement 6: Matching Preferences Collection

**User Story:** As a new user, I want to specify my matching preferences, so that I receive relevant match suggestions.

#### Acceptance Criteria

1. THE Profile_Form SHALL collect preferred age range with minimum and maximum values
2. THE Profile_Form SHALL collect preferred gender as a selection from predefined options
3. THE Profile_Form SHALL collect preferred maximum distance as a number field
4. THE Profile_Form SHALL collect preferred relationship type as a selection from predefined options
5. WHEN all preference fields are valid, THE Frontend_Client SHALL enable the next button to proceed to photo upload

### Requirement 7: Profile Photo Upload

**User Story:** As a new user, I want to upload 2-5 profile photos, so that other users can see what I look like.

#### Acceptance Criteria

1. THE Photo_Upload_Module SHALL require minimum 2 photos and maximum 5 photos
2. THE Photo_Upload_Module SHALL accept only image files in JPEG, PNG, or WebP format
3. THE Photo_Upload_Module SHALL reject files larger than 5MB with a descriptive error message
4. WHEN the user selects a valid photo, THE Frontend_Client SHALL display a preview of the photo
5. WHEN the user uploads a photo, THE Photo_Upload_Module SHALL upload the file to Supabase_Storage
6. WHEN a photo upload succeeds, THE Frontend_Client SHALL store the Supabase URL in Session_State
7. WHEN a photo upload fails, THE Frontend_Client SHALL display an error message and allow retry
8. THE Photo_Upload_Module SHALL allow the user to remove uploaded photos before proceeding
9. THE Photo_Upload_Module SHALL allow the user to designate one photo as the primary profile photo
10. WHEN the user has uploaded between 2 and 5 photos, THE Frontend_Client SHALL enable the next button to proceed to face verification

### Requirement 8: Photo Upload Security

**User Story:** As a platform administrator, I want uploaded photos to be access-controlled, so that user privacy is protected.

#### Acceptance Criteria

1. THE Backend_API SHALL generate signed URLs for Supabase_Storage uploads with expiration time of 1 hour
2. THE Backend_API SHALL store photo URLs with user-specific access policies in Supabase_Storage
3. THE Backend_API SHALL verify that the authenticated user owns the photos being uploaded
4. WHEN an unauthenticated request attempts photo upload, THE Backend_API SHALL return a 401 Unauthorized error

### Requirement 9: Client-Side Face Detection

**User Story:** As a new user, I want immediate feedback during face verification, so that I know if my photo will be accepted.

#### Acceptance Criteria

1. WHEN the user accesses the face verification step, THE Frontend_Client SHALL request camera permissions
2. WHEN camera permissions are granted, THE Face_Verification_Module SHALL initialize Face_API_JS
3. WHILE the camera is active, THE Face_Verification_Module SHALL continuously detect faces using Face_API_JS
4. WHEN Face_API_JS detects exactly one face, THE Frontend_Client SHALL display a green indicator and enable the capture button
5. WHEN Face_API_JS detects zero faces or multiple faces, THE Frontend_Client SHALL display guidance to adjust positioning
6. WHEN Face_API_JS detects poor lighting or image quality, THE Frontend_Client SHALL display guidance to improve conditions

### Requirement 10: Face Verification Capture

**User Story:** As a new user, I want to capture a verification selfie, so that I can prove I am a real person.

#### Acceptance Criteria

1. WHEN the user clicks the capture button, THE Face_Verification_Module SHALL capture the current camera frame as an image
2. THE Face_Verification_Module SHALL compress the captured image to maximum 1MB while maintaining sufficient quality for verification
3. THE Face_Verification_Module SHALL convert the captured image to JPEG format
4. WHEN the image is captured, THE Frontend_Client SHALL display a preview and ask for confirmation
5. WHEN the user confirms the captured image, THE Frontend_Client SHALL proceed to backend verification
6. WHEN the user rejects the captured image, THE Frontend_Client SHALL return to camera view for recapture

### Requirement 11: Backend Face Verification

**User Story:** As a platform administrator, I want to verify user faces using AI, so that I can ensure profile authenticity.

#### Acceptance Criteria

1. WHEN the Frontend_Client submits a verification selfie, THE Backend_API SHALL receive the image and authenticated user ID
2. THE Backend_API SHALL validate that the image size is less than 1MB
3. THE Backend_API SHALL validate that the image format is JPEG or PNG
4. THE Backend_API SHALL send the verification selfie to Gemini_Vision_API with a liveness detection prompt
5. THE Backend_API SHALL send one of the user's profile photos to Gemini_Vision_API for face matching comparison
6. WHEN Gemini_Vision_API responds, THE Backend_API SHALL parse the response to determine verification success or failure
7. THE Backend_API SHALL create a Verification_Log record with the selfie URL, AI response, and verification status
8. WHEN verification succeeds, THE Backend_API SHALL update the User_Profile verification status to VERIFIED
9. WHEN verification fails, THE Backend_API SHALL update the User_Profile verification status to REJECTED with the failure reason
10. THE Backend_API SHALL return the verification result to the Frontend_Client

### Requirement 12: Liveness Detection

**User Story:** As a platform administrator, I want to detect if verification photos are of live people, so that I can prevent fake profiles using static images.

#### Acceptance Criteria

1. THE Backend_API SHALL include a liveness detection prompt when calling Gemini_Vision_API
2. THE Backend_API SHALL instruct Gemini_Vision_API to check for signs of a live person including natural lighting, depth, and micro-movements
3. THE Backend_API SHALL instruct Gemini_Vision_API to reject photos of screens, printed photos, or videos
4. WHEN Gemini_Vision_API detects a non-live image, THE Backend_API SHALL record the verification as failed with reason "liveness check failed"

### Requirement 13: Face Matching Verification

**User Story:** As a platform administrator, I want to verify that the selfie matches the profile photos, so that I can prevent users from using photos of different people.

#### Acceptance Criteria

1. THE Backend_API SHALL compare the verification selfie with the user's primary profile photo using Gemini_Vision_API
2. THE Backend_API SHALL instruct Gemini_Vision_API to determine if the faces in both images are the same person
3. WHEN Gemini_Vision_API determines the faces do not match, THE Backend_API SHALL record the verification as failed with reason "face mismatch"
4. WHEN Gemini_Vision_API determines the faces match with high confidence, THE Backend_API SHALL proceed with verification approval

### Requirement 14: Verification Retry Logic

**User Story:** As a new user, I want to retry face verification if it fails, so that I can complete onboarding despite temporary issues.

#### Acceptance Criteria

1. WHEN verification fails, THE Frontend_Client SHALL display the specific failure reason to the user
2. THE Frontend_Client SHALL allow the user to retry verification up to 3 times within a 24-hour period
3. WHEN the user has exhausted retry attempts, THE Frontend_Client SHALL display a message to contact support
4. THE Backend_API SHALL track retry attempts in Verification_Log records
5. WHEN the user retries verification, THE Frontend_Client SHALL return to the camera capture step

### Requirement 15: Verification Rate Limiting

**User Story:** As a platform administrator, I want to rate limit verification attempts, so that I can prevent API abuse and control costs.

#### Acceptance Criteria

1. THE Backend_API SHALL implement a Rate_Limiter allowing maximum 3 verification attempts per user per 24-hour period
2. WHEN a user exceeds the rate limit, THE Backend_API SHALL return a 429 Too Many Requests error with retry-after information
3. THE Backend_API SHALL implement a Rate_Limiter allowing maximum 100 verification attempts per IP address per hour
4. WHEN an IP address exceeds the rate limit, THE Backend_API SHALL return a 429 Too Many Requests error

### Requirement 16: Onboarding Data Persistence

**User Story:** As a new user, I want my onboarding progress to be saved, so that I can complete it across multiple sessions.

#### Acceptance Criteria

1. WHEN the user completes each form step, THE Frontend_Client SHALL save the step data to Session_State in browser local storage
2. WHEN the user returns to the onboarding flow, THE Frontend_Client SHALL restore progress from Session_State
3. WHEN the user completes photo uploads, THE Backend_API SHALL immediately persist photo URLs to the User_Profile record
4. WHEN the user completes face verification successfully, THE Backend_API SHALL persist all onboarding data to the User_Profile record in a single transaction
5. WHEN the user completes face verification successfully, THE Backend_API SHALL set the isOnboarded flag to true on the User_Profile record
6. WHEN the onboarding data persistence transaction fails, THE Backend_API SHALL return an error and allow the user to retry

### Requirement 17: Onboarding Completion

**User Story:** As a new user, I want to see a completion screen after successful onboarding, so that I know I can start using the app.

#### Acceptance Criteria

1. WHEN face verification succeeds and data is persisted, THE Frontend_Client SHALL display a success screen
2. THE Frontend_Client SHALL display a congratulatory message on the success screen
3. THE Frontend_Client SHALL provide a button to proceed to the main application
4. WHEN the user clicks the proceed button, THE Frontend_Client SHALL navigate to the main application dashboard
5. THE Frontend_Client SHALL clear Session_State after successful onboarding completion

### Requirement 18: Onboarding Abandonment Handling

**User Story:** As a new user, I want to be able to exit and resume onboarding, so that I can complete it at my convenience.

#### Acceptance Criteria

1. THE Frontend_Client SHALL provide an exit option on each onboarding step
2. WHEN the user exits onboarding, THE Frontend_Client SHALL save current progress to Session_State
3. WHEN an authenticated user with incomplete onboarding accesses the application, THE Frontend_Client SHALL redirect to the onboarding flow
4. WHEN the user resumes onboarding, THE Frontend_Client SHALL restore progress to the last completed step

### Requirement 19: Database Schema for User Profiles

**User Story:** As a platform administrator, I want a comprehensive database schema for user profiles, so that all onboarding data is properly stored.

#### Acceptance Criteria

1. THE Backend_API SHALL use the existing User model in Prisma schema with fields: clerkId, name, age, gender, bio, location, profilePhotos, primaryPhotoUrl, verificationSelfieUrl, verificationStatus, interests, personalityAnswers, preferences, isOnboarded
2. THE Backend_API SHALL store profile photos as an array of Supabase URLs in the profilePhotos field
3. THE Backend_API SHALL store personality answers as JSON in the personalityAnswers field
4. THE Backend_API SHALL store matching preferences as JSON in the preferences field
5. THE Backend_API SHALL store verification status as an enum with values: UNVERIFIED, PENDING, VERIFIED, REJECTED

### Requirement 20: Database Schema for Verification Audit Trail

**User Story:** As a platform administrator, I want an audit trail of verification attempts, so that I can review verification history and detect patterns of abuse.

#### Acceptance Criteria

1. THE Backend_API SHALL use the existing VerificationLog model in Prisma schema with fields: userId, selfieUrl, aiCheckPassed, aiReason, reviewedBy, status, createdAt
2. WHEN a verification attempt is made, THE Backend_API SHALL create a VerificationLog record before calling Gemini_Vision_API
3. WHEN Gemini_Vision_API responds, THE Backend_API SHALL update the VerificationLog record with the AI response and result
4. THE Backend_API SHALL store the complete Gemini_Vision_API response in the aiReason field for failed verifications
5. THE Backend_API SHALL set reviewedBy to "ai" for automated verifications

### Requirement 21: API Key Configuration

**User Story:** As a platform administrator, I want to securely configure API keys, so that the system can access external services.

#### Acceptance Criteria

1. THE Backend_API SHALL require GEMINI_API_KEY environment variable for Gemini Vision API access
2. THE Frontend_Client SHALL require NEXT_PUBLIC_SUPABASE_URL environment variable for Supabase access
3. THE Frontend_Client SHALL require NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable for Supabase access
4. THE Backend_API SHALL require SUPABASE_SERVICE_KEY environment variable for server-side Supabase operations
5. WHEN any required environment variable is missing, THE application SHALL fail to start with a descriptive error message
6. THE Backend_API SHALL never expose API keys in client-side code or API responses

### Requirement 22: Error Handling for External Services

**User Story:** As a new user, I want clear error messages when external services fail, so that I understand what went wrong and what to do next.

#### Acceptance Criteria

1. WHEN Supabase_Storage is unavailable, THE Frontend_Client SHALL display an error message "Photo upload service is temporarily unavailable. Please try again later."
2. WHEN Gemini_Vision_API is unavailable, THE Backend_API SHALL return an error message "Verification service is temporarily unavailable. Please try again later."
3. WHEN Gemini_Vision_API returns an error, THE Backend_API SHALL log the error details and return a user-friendly message
4. WHEN Gemini_Vision_API rate limit is exceeded, THE Backend_API SHALL return an error message "Verification service is busy. Please try again in a few minutes."
5. WHEN the database is unavailable, THE Backend_API SHALL return an error message "Service is temporarily unavailable. Please try again later."

### Requirement 23: Gemini Vision API Integration

**User Story:** As a platform administrator, I want to integrate with Gemini Vision API, so that I can perform AI-powered face verification.

#### Acceptance Criteria

1. THE Backend_API SHALL use the Gemini Vision API endpoint for image analysis
2. THE Backend_API SHALL send images to Gemini_Vision_API in base64-encoded format
3. THE Backend_API SHALL include a structured prompt requesting liveness detection and face matching analysis
4. THE Backend_API SHALL set a timeout of 30 seconds for Gemini_Vision_API requests
5. WHEN Gemini_Vision_API request times out, THE Backend_API SHALL record the verification as failed with reason "verification timeout"
6. THE Backend_API SHALL parse Gemini_Vision_API JSON responses to extract verification results

### Requirement 24: Cost Monitoring for API Usage

**User Story:** As a platform administrator, I want to monitor Gemini API usage costs, so that I can control expenses.

#### Acceptance Criteria

1. THE Backend_API SHALL log each Gemini_Vision_API request with timestamp and user ID
2. THE Backend_API SHALL log the image size sent to Gemini_Vision_API for cost calculation
3. THE Backend_API SHALL track the number of Gemini_Vision_API requests per day
4. THE Backend_API SHALL provide an endpoint to retrieve API usage statistics for the current billing period

### Requirement 25: Image Size Optimization

**User Story:** As a platform administrator, I want to optimize image sizes sent to Gemini API, so that I can minimize costs while maintaining verification accuracy.

#### Acceptance Criteria

1. THE Frontend_Client SHALL resize verification selfies to maximum 1024x1024 pixels before upload
2. THE Frontend_Client SHALL compress verification selfies to maximum 1MB file size
3. THE Backend_API SHALL resize profile photos to maximum 1024x1024 pixels before sending to Gemini_Vision_API
4. THE Backend_API SHALL validate that images sent to Gemini_Vision_API do not exceed 1MB
5. WHEN an image exceeds size limits, THE Backend_API SHALL reject the request with error message "Image size exceeds maximum allowed"
