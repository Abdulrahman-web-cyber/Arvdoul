// src/utils/SignupSuccessHandler.jsx - Handle post-signup navigation
// ✅ No Conflicts • Manual Flow • Perfect Navigation

export class SignupSuccessHandler {
  static async handleSignupSuccess(method, result, navigate, userService, step1Data = null) {
    console.log(`✅ ${method.toUpperCase()} signup successful:`, result);
    
    if (!result || !result.user) {
      throw new Error('Invalid signup result');
    }
    
    const user = result.user;
    
    // Store signup data in session storage
    const signupData = {
      method,
      userId: user.uid,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      displayName: user.displayName || (step1Data ? `${step1Data.firstName} ${step1Data.lastName}`.trim() : ''),
      photoURL: user.photoURL || null,
      isNewUser: user.isNewUser || true,
      requiresProfileCompletion: true,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem('signup_data', JSON.stringify(signupData));
    
    // Create user profile immediately for Google/Phone signups
    if (method === 'google' || method === 'phone') {
      try {
        if (userService) {
          const profileData = {
            uid: user.uid,
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName || signupData.displayName,
            firstName: step1Data?.firstName || '',
            lastName: step1Data?.lastName || '',
            photoURL: user.photoURL,
            authProvider: method,
            isProfileComplete: false,
            accountStatus: 'active'
          };
          
          await userService.createUserProfile(user.uid, profileData);
          console.log('✅ User profile created during signup');
          
          // Navigate to home since profile is created
          setTimeout(() => {
            navigate('/home', { replace: true });
          }, 100);
          return;
        }
      } catch (profileError) {
        console.warn('Profile creation failed, will redirect to setup:', profileError);
        // Continue to setup profile
      }
    }
    
    // Navigate based on method and requirements
    switch (method) {
      case 'email':
        if (user.requiresEmailVerification && !user.emailVerified) {
          navigate('/verify-email', {
            state: {
              userId: user.uid,
              userEmail: user.email,
              fromSignup: true
            },
            replace: true
          });
        } else {
          navigate('/setup-profile', {
            state: {
              userId: user.uid,
              userData: user,
              fromSignup: true
            },
            replace: true
          });
        }
        break;
        
      case 'google':
      case 'phone':
        navigate('/setup-profile', {
          state: {
            userId: user.uid,
            userData: user,
            method,
            fromSignup: true
          },
          replace: true
        });
        break;
        
      default:
        navigate('/home', { replace: true });
    }
  }
  
  static clearSignupData() {
    ['email_signup_data', 'google_auth_data', 'phone_signup_data', 'signup_data'].forEach(key => {
      sessionStorage.removeItem(key);
    });
  }
}