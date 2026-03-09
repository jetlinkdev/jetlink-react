import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
  Unsubscribe
} from 'firebase/auth';
import { auth } from '../config/firebase';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: () => Promise<string>;
};

export type AuthStateCallback = (user: AuthUser | null) => void;

class AuthService {
  private provider: GoogleAuthProvider;
  private currentUser: AuthUser | null = null;
  private authStateInitialized = false;

  constructor() {
    this.provider = new GoogleAuthProvider();
    this.provider.addScope('email');
    this.provider.addScope('profile');

    // Listen to auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user ? this.mapUser(user) : null;
      this.authStateInitialized = true;
      this.notifyAuthStateListeners(this.currentUser);
    });
  }

  private authStateListeners: AuthStateCallback[] = [];

  private notifyAuthStateListeners(user: AuthUser | null) {
    this.authStateListeners.forEach(callback => callback(user));
  }

  public subscribeToAuthState(callback: AuthStateCallback): Unsubscribe {
    this.authStateListeners.push(callback);
    
    // Only call immediately if Firebase has already initialized
    if (this.authStateInitialized) {
      callback(this.currentUser);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public async signInWithGoogle(): Promise<AuthUser | null> {
    try {
      const result = await signInWithPopup(auth, this.provider);
      const user = result.user;
      return this.mapUser(user);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      return null;
    }
  }

  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      this.currentUser = null;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  private mapUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      getIdToken: () => user.getIdToken(),
    };
  }
}

export const authService = new AuthService();
