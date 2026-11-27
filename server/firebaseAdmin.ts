import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let dbInstance: Firestore | null = null;

export function getServerFirestore(): Firestore {
  if (dbInstance) {
    return dbInstance;
  }

  if (
    !firebaseConfig?.projectId ||
    firebaseConfig.projectId === 'remixed-project-id' ||
    firebaseConfig.firestoreDatabaseId === 'remixed-firestore-database-id'
  ) {
    throw new Error('Firebase no está configurado correctamente en firebase-applet-config.json.');
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        projectId: firebaseConfig.projectId,
      });

  const dbId = firebaseConfig.firestoreDatabaseId;
  dbInstance =
    dbId && dbId !== '(default)'
      ? getFirestore(app, dbId)
      : getFirestore(app);
  dbInstance.settings({ preferRest: true });

  return dbInstance;
}
