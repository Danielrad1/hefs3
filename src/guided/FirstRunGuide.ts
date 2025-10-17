import AsyncStorage from '@react-native-async-storage/async-storage';

const hasUid = (uid?: string | null): uid is string => typeof uid === 'string' && uid.length > 0;
const key = (uid: string, suffix: string) => `@firstRun:${uid}:${suffix}`;

export const FirstRunGuide = {
  async shouldShowWelcome(uid?: string | null): Promise<boolean> {
    if (!hasUid(uid)) return false;
    const shown = await AsyncStorage.getItem(key(uid, 'welcome:shown'));
    return shown !== 'true';
  },
  async markWelcomeShown(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.setItem(key(uid, 'welcome:shown'), 'true');
  },
  async shouldShowDiscover(uid?: string | null): Promise<boolean> {
    if (!hasUid(uid)) return false;
    const done = await AsyncStorage.getItem(key(uid, 'discover:done'));
    const shown = await AsyncStorage.getItem(key(uid, 'discover:shown'));
    return done !== 'true' && shown !== 'true';
  },
  async markDiscoverShown(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.setItem(key(uid, 'discover:shown'), 'true');
  },
  async completeDiscover(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.multiSet([
      [key(uid, 'discover:done'), 'true'],
      [key(uid, 'study:scheduled'), 'true'],
      [key(uid, 'study:shown'), 'false'],
    ]);
  },
  async shouldShowStudy(uid?: string | null): Promise<boolean> {
    if (!hasUid(uid)) return false;
    const scheduled = await AsyncStorage.getItem(key(uid, 'study:scheduled'));
    const done = await AsyncStorage.getItem(key(uid, 'study:done'));
    const shown = await AsyncStorage.getItem(key(uid, 'study:shown'));
    return scheduled === 'true' && done !== 'true' && shown !== 'true';
  },
  async markStudyShown(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.setItem(key(uid, 'study:shown'), 'true');
  },
  async completeStudy(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.setItem(key(uid, 'study:done'), 'true');
  },
  async resetAll(uid?: string | null): Promise<void> {
    if (!hasUid(uid)) return;
    await AsyncStorage.multiRemove([
      key(uid, 'welcome:shown'),
      key(uid, 'discover:shown'),
      key(uid, 'discover:done'),
      key(uid, 'study:scheduled'),
      key(uid, 'study:shown'),
      key(uid, 'study:done'),
    ]);
  },
};
