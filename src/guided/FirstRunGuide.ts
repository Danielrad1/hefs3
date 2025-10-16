import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  DISCOVER_SHOWN: '@firstRun:discover:shown',
  DISCOVER_DONE: '@firstRun:discover:done',
  STUDY_SCHEDULED: '@firstRun:study:scheduled',
  STUDY_SHOWN: '@firstRun:study:shown',
  STUDY_DONE: '@firstRun:study:done',
};

export const FirstRunGuide = {
  async shouldShowDiscover(): Promise<boolean> {
    const done = await AsyncStorage.getItem(K.DISCOVER_DONE);
    const shown = await AsyncStorage.getItem(K.DISCOVER_SHOWN);
    return done !== 'true' && shown !== 'true';
  },
  async markDiscoverShown(): Promise<void> {
    await AsyncStorage.setItem(K.DISCOVER_SHOWN, 'true');
  },
  async completeDiscover(): Promise<void> {
    await AsyncStorage.multiSet([
      [K.DISCOVER_DONE, 'true'],
      [K.STUDY_SCHEDULED, 'true'],
      [K.STUDY_SHOWN, 'false'],
    ]);
  },
  async shouldShowStudy(): Promise<boolean> {
    const scheduled = await AsyncStorage.getItem(K.STUDY_SCHEDULED);
    const done = await AsyncStorage.getItem(K.STUDY_DONE);
    const shown = await AsyncStorage.getItem(K.STUDY_SHOWN);
    return scheduled === 'true' && done !== 'true' && shown !== 'true';
  },
  async markStudyShown(): Promise<void> {
    await AsyncStorage.setItem(K.STUDY_SHOWN, 'true');
  },
  async completeStudy(): Promise<void> {
    await AsyncStorage.setItem(K.STUDY_DONE, 'true');
  },
  async resetAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      K.DISCOVER_SHOWN, K.DISCOVER_DONE, K.STUDY_SCHEDULED, K.STUDY_SHOWN, K.STUDY_DONE,
    ]);
  },
};

