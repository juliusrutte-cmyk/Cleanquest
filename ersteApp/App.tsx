//npx expo start --tunnel
 
import { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import firebaseService from './firebaseConfig';

import { Animated, Easing, StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Modal, PanResponder } from 'react-native';

interface User {
  id: string;
  username: string;
  age: number;
  email?: string;
  availability?: AvailabilityAnswer[];
  strengths?: Strength[];
}

interface FamilyProfile {
  id: string;
  name: string;
  code: string;
  admin: string;
  members: User[];
  createdAt: Date;
}

interface AvailabilityAnswer {
  day: string;
  hours: string[];
}

interface Strength {
  id: string;
  name: string;
  rating: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
}

interface DatabaseStore {
  families: { [key: string]: FamilyProfile };
  chats: { [familyId: string]: ChatMessage[] };
}

// Global family storage - all families are stored in Firebase for cross-device access
const globalFamiliesKey = 'cleanquest_all_families_global';

// Wrapper für localStorage Fallback
const getAllGlobalFamilies = async () => {
  if (firebaseService.isAvailable()) {
    return await firebaseService.getAllFamilies();
  }
  // Fallback zu localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const all = localStorage.getItem(globalFamiliesKey);
      return all ? JSON.parse(all) : {};
    }
    return {};
  } catch (e) {
    console.error('Error reading global families:', e);
    return {};
  }
};

const saveFamilyGlobally = async (code: string, family: FamilyProfile) => {
  if (firebaseService.isAvailable()) {
    return await firebaseService.saveFamilyGlobally(code, family);
  }
  // Fallback zu localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const allFamilies = await getAllGlobalFamilies();
      allFamilies[code] = family;
      localStorage.setItem(globalFamiliesKey, JSON.stringify(allFamilies));
      console.log('Family saved globally with code:', code);
    }
  } catch (e) {
    console.error('Error saving family globally:', e);
  }
};

const getFamilyByCode = async (code: string) => {
  if (firebaseService.isAvailable()) {
    return await firebaseService.getFamilyByCode(code.toUpperCase());
  }
  // Fallback zu localStorage
  try {
    const allFamilies = await getAllGlobalFamilies();
    const family = allFamilies[code.toUpperCase()];
    console.log('Looking for family with code:', code.toUpperCase(), 'Found:', family ? true : false);
    return family || null;
  } catch (e) {
    console.error('Error getting family:', e);
    return null;
  }
};

// Simple localStorage-based database
const getStorageKey = (key: string) => `cleanquest_${key}`;

const saveToStorage = (key: string, data: any) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(getStorageKey(key), JSON.stringify(data));
    }
  } catch (e) {
    console.log('Storage write error:', e);
  }
};

const getFromStorage = (key: string, defaultValue: any = null) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = localStorage.getItem(getStorageKey(key));
      return item ? JSON.parse(item) : defaultValue;
    }
    return defaultValue;
  } catch (e) {
    console.log('Storage read error:', e);
    return defaultValue;
  }
};

// Generate simple shareable URL
const generateSharingLink = (familyCode: string) => {
  try {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}?join=${familyCode}`;
    }
    return familyCode;
  } catch (e) {
    return familyCode;
  }
};

// Parse URL for family code
const parseUrlForCode = () => {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('join');
      if (code) {
        return code.toUpperCase();
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

export default function App() {
  // Auth & User Management
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentFamily, setCurrentFamily] = useState<FamilyProfile | null>(null);
  const [authStage, setAuthStage] = useState<'login' | 'accountRegistration' | 'familySelection' | 'createFamily' | 'joinFamily' | 'showCode' | 'register' | 'questionnaire' | 'app'>(() => {
    const savedUser = getFromStorage('currentUser', null);
    return savedUser ? 'app' : 'login';
  });
  
  // Database
  const [accounts, setAccounts] = useState<{ [username: string]: { password: string; createdAt: string } }>(() => 
    getFromStorage('accounts', {})
  );
  const [families, setFamilies] = useState<{ [key: string]: FamilyProfile }>(() => 
    getFromStorage('families', {})
  );
  const [allChats, setAllChats] = useState<{ [familyId: string]: ChatMessage[] }>(() => 
    getFromStorage('chats', {})
  );
  
  // Initial Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Account Registration form
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  
  // Registration form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  
  // Family management modal
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyModalMode, setFamilyModalMode] = useState<'create' | 'join'>('create');
  
  // Family setup
  const [familyName, setFamilyName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [sharingLink, setSharingLink] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  
  // Questionnaire
  const [availability, setAvailability] = useState<AvailabilityAnswer[]>([
    { day: 'Montag', hours: [] },
    { day: 'Dienstag', hours: [] },
    { day: 'Mittwoch', hours: [] },
    { day: 'Donnerstag', hours: [] },
    { day: 'Freitag', hours: [] },
    { day: 'Samstag', hours: [] },
    { day: 'Sonntag', hours: [] }
  ]);
  const [strengths, setStrengths] = useState<Strength[]>([
    { id: '1', name: 'Putzen', rating: 0 },
    { id: '2', name: 'Kochen', rating: 0 },
    { id: '3', name: 'Wäsche', rating: 0 },
    { id: '4', name: 'Einkaufen', rating: 0 },
    { id: '5', name: 'Reparaturen', rating: 0 },
    { id: '6', name: 'Garten', rating: 0 }
  ]);
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Original App State
  const [activeTab, setActiveTab] = useState(0); // 0: Familie, 1: Kalender, 2: Chat, 3: Todos
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [events, setEvents] = useState<{ [key: string]: { time: string; description: string }[] }>({});
  const [eventTime, setEventTime] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const today = new Date();
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const lastGreetingDayRef = useRef('');
  const [todos, setTodos] = useState<{ id: string; text: string; completed: boolean; reminderTime?: string; isFadingOut?: boolean; fadeOutAnim?: Animated.Value }[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoReminder, setNewTodoReminder] = useState('');
  const [showAddTodo, setShowAddTodo] = useState(false);
  const fadeOutAnimRef = useRef<{ [key: string]: Animated.Value }>({});

  const greetings = [
    'Guten Morgen, (user)! Bereit, eine Quest zu erledigen?',
    'Neuer Tag, neues Gelingen!',
    'Bereit für eine Quest?'
  ];
  "cd ersteApp";

  // Initialize app - check if user is logged in
  useEffect(() => {
    const savedUser = getFromStorage('currentUser', null);
    const savedFamily = getFromStorage('selectedFamily', null);
    
    if (savedUser) {
      setCurrentUser(savedUser);
      if (savedFamily) {
        setCurrentFamily(savedFamily);
      }
      setAuthStage('app');
    }
  }, []);

  // Check for sharing link on app load
  useEffect(() => {
    const checkUrl = async () => {
      const codeFromUrl = parseUrlForCode();
      if (codeFromUrl) {
        const foundFamily = await getFamilyByCode(codeFromUrl);
        if (foundFamily) {
          setJoinCode(codeFromUrl);
          setFamilyModalMode('join');
        }
      }
    };
    checkUrl();
  }, []);

  // Authentication functions
  const handleRegisterAccount = () => {
    setRegError('');
    setRegSuccess('');
    
    // Validierung
    if (!regUsername.trim()) {
      setRegError('Benutzername erforderlich');
      return;
    }
    
    if (regUsername.trim().length < 3) {
      setRegError('Benutzername muss mindestens 3 Zeichen lang sein');
      return;
    }
    
    if (!regPassword.trim()) {
      setRegError('Passwort erforderlich');
      return;
    }
    
    if (regPassword.length < 4) {
      setRegError('Passwort muss mindestens 4 Zeichen lang sein');
      return;
    }
    
    if (regPassword !== regPasswordConfirm) {
      setRegError('Passwörter stimmen nicht überein');
      return;
    }
    
    // Check if username already exists
    if (accounts[regUsername.trim()]) {
      setRegError('Dieser Benutzername existiert bereits');
      return;
    }
    
    // Create account
    const updatedAccounts = {
      ...accounts,
      [regUsername.trim()]: {
        password: regPassword,
        createdAt: new Date().toISOString()
      }
    };
    
    setAccounts(updatedAccounts);
    saveToStorage('accounts', updatedAccounts);
    
    setRegSuccess('✓ Konto erstellt! Du kannst dich jetzt anmelden.');
    
    // Clear form
    setTimeout(() => {
      setRegUsername('');
      setRegPassword('');
      setRegPasswordConfirm('');
      setRegSuccess('');
      setAuthStage('login');
    }, 1500);
  };

  const handleLogin = () => {
    if (loginUsername.trim() && loginPassword.trim()) {
      // Check against registered accounts
      const account = accounts[loginUsername.trim()];
      
      if (!account || account.password !== loginPassword) {
        setLoginError('Benutzername oder Passwort falsch');
        return;
      }
      
      const loggedInUser: User = {
        id: Date.now().toString(),
        username: loginUsername,
        age: 0, // Will be set during family setup
        email: loginUsername + '@cleanquest.local'
      };
      
      // Save user for persistent storage
      setCurrentUser(loggedInUser);
      saveToStorage('currentUser', loggedInUser);
      setAuthStage('familySelection');
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
    } else {
      setLoginError('Benutzername und Passwort erforderlich');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentFamily(null);
    saveToStorage('currentUser', null);
    saveToStorage('selectedFamily', null);
    setAuthStage('login');
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setRegUsername('');
    setRegPassword('');
    setRegPasswordConfirm('');
    setRegError('');
    setRegSuccess('');
    setUsername('');
    setPassword('');
    setAge('');
    setFamilyName('');
    setGeneratedCode('');
    setSharingLink('');
    setJoinCode('');
    setJoinError('');
  };
  const generateFamilyCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateFamily = async () => {
    if (familyName.trim()) {
      const code = generateFamilyCode();
      const newFamily: FamilyProfile = {
        id: Date.now().toString(),
        name: familyName,
        code: code,
        admin: '',
        members: [],
        createdAt: new Date()
      };
      
      // Save to global families (for cross-device sharing)
      await saveFamilyGlobally(code, newFamily);
      
      // Also save locally
      const updatedFamilies = { ...families, [code]: newFamily };
      setFamilies(updatedFamilies);
      saveToStorage('families', updatedFamilies);
      
      const link = generateSharingLink(code);
      
      setCurrentFamily(newFamily);
      setGeneratedCode(code);
      setSharingLink(link);
      setFamilyName('');
      setAuthStage('showCode');
    }
  };

  const handleProceedAfterCode = () => {
    setAuthStage('register');
  };

  const handleJoinFamily = async () => {
    if (joinCode.trim()) {
      const code = joinCode.toUpperCase().trim();
      
      // Try to get family from global storage
      let foundFamily = await getFamilyByCode(code);
      
      if (!foundFamily) {
        // Try local families as backup
        foundFamily = families[code];
      }
      
      if (foundFamily) {
        // Import to local
        const updatedFamilies = { ...families, [code]: foundFamily };
        setFamilies(updatedFamilies);
        saveToStorage('families', updatedFamilies);
        
        setCurrentFamily(foundFamily);
        setJoinCode('');
        setJoinError('');
        setAuthStage('register');
      } else {
        setJoinError('Familiencode nicht gefunden. Überprüfen Sie den Code.');
      }
    }
  };

  const handleRegister = () => {
    if (username.trim() && password.trim() && age.trim() && currentFamily) {
      const newUser: User = {
        id: Date.now().toString(),
        username: username,
        age: parseInt(age) || 0,
      };
      setCurrentUser(newUser);
      setAuthStage('questionnaire');
      setUsername('');
      setPassword('');
      setAge('');
    }
  };

  const handleQuestionnaireComplete = async () => {
    if (currentUser && currentFamily) {
      // Update user with availability and strengths
      const updatedUser: User = {
        ...currentUser,
        availability: availability,
        strengths: strengths
      };
      
      // Add user to family and update
      const updatedFamily = {
        ...currentFamily,
        members: [...currentFamily.members, updatedUser]
      };
      
      // Set admin if first member
      if (updatedFamily.members.length === 1) {
        updatedFamily.admin = updatedUser.id;
      }
      
      // Save updated family to both local and global
      const updatedFamilies = { ...families, [updatedFamily.code]: updatedFamily };
      setFamilies(updatedFamilies);
      saveToStorage('families', updatedFamilies);
      await saveFamilyGlobally(updatedFamily.code, updatedFamily);
      
      // Save current user and family for persistent storage
      saveToStorage('currentUser', updatedUser);
      saveToStorage('selectedFamily', updatedFamily);
      
      // Initialize chat for family if not exists
      if (!allChats[updatedFamily.id]) {
        const updatedChats = { ...allChats, [updatedFamily.id]: [] };
        setAllChats(updatedChats);
        saveToStorage('chats', updatedChats);
      }
      
      setCurrentUser(updatedUser);
      setCurrentFamily(updatedFamily);
      setChatMessages(allChats[updatedFamily.id] || []);
      setAuthStage('app');
      setActiveTab(0);
    }
  };

  const sendChatMessage = async () => {
    if (newMessage.trim() && currentUser && currentFamily) {
      const message: ChatMessage = {
        id: Date.now().toString(),
        sender: currentUser.username,
        text: newMessage,
        timestamp: new Date()
      };
      
      const updatedMessages = [...chatMessages, message];
      setChatMessages(updatedMessages);
      
      // Save to database - Firebase first if available
      if (firebaseService.isAvailable()) {
        await firebaseService.saveChatMessage(currentFamily.code, message);
      }
      
      // Also save locally
      const updatedChats = { ...allChats, [currentFamily.id]: updatedMessages };
      setAllChats(updatedChats);
      saveToStorage('chats', updatedChats);
      
      setNewMessage('');
    }
  };

  const updateStrengthRating = (strengthId: string, rating: number) => {
    setStrengths(strengths.map(s =>
      s.id === strengthId ? { ...s, rating } : s
    ));
  };

  const updateAvailability = (dayIndex: number, hours: string[]) => {
    const newAvailability = [...availability];
    newAvailability[dayIndex].hours = hours;
    setAvailability(newAvailability);
  };

  // animation state for border and moving stroke around greeting box
  const [boxLayout, setBoxLayout] = useState({ width: 0, height: 0 });
  const progress = useRef(new Animated.Value(0)).current; // 0..1 around perimeter
  const borderOpacityAnim = useRef(new Animated.Value(0)).current;
  const [strokeStyle, setStrokeStyle] = useState({ left: -50, top: -50, width: 0, height: 0 });
  const strokeThickness = 4;


  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);

    // Wenn HMR / Fast Refresh läuft, beim Code-Update den Timer zurücksetzen
    try {
      if (typeof module !== 'undefined' && (module as any).hot) {
        (module as any).hot.accept(() => {
          setLastUpdated(new Date());
        });
      }
    } catch (e) {
      // ignore if module isn't available in this environment
    }

    return () => clearInterval(t);
  }, []);

  // Update greeting once per day (or on first render)
  useEffect(() => {
    const todayStr = now.toDateString();
    if (lastGreetingDayRef.current !== todayStr || !greeting) {
      lastGreetingDayRef.current = todayStr;
      const pick = greetings[Math.floor(Math.random() * greetings.length)];
      setGreeting(pick);
    }
  }, [now, greeting]);

  // run animation when greeting is set and box size known
  useEffect(() => {
    if (!greeting || boxLayout.width <= 0 || boxLayout.height <= 0) return;

    progress.setValue(0);
    borderOpacityAnim.setValue(0);

    const listenerId = progress.addListener(({ value }) => {
      const w = boxLayout.width;
      const h = boxLayout.height;
      const cornerRadius = 12;
      // simple perimeter: 2*(w + h) gives good smooth motion
      const perimeter = 2 * (w + h);
      const dist = value * perimeter;
      const L = 32; // fixed stroke length for smooth motion

      let left = 0;
      let top = 0;
      let width = L;
      let height = strokeThickness;

      if (dist <= w) {
        // top edge, left -> right
        left = Math.max(0, dist - L / 2);
        top = -strokeThickness / 2;
        width = L;
        height = strokeThickness;
      } else if (dist <= w + h) {
        // right edge + top-right corner blend, top -> bottom
        left = w - strokeThickness / 2;
        top = Math.max(-strokeThickness / 2, dist - w - L / 2);
        width = strokeThickness;
        height = L;
      } else if (dist <= w + h + w) {
        // bottom edge, right -> left
        const d2 = dist - (w + h);
        left = Math.min(w - L / 2, w - d2 - L / 2);
        top = h - strokeThickness / 2;
        width = L;
        height = strokeThickness;
      } else {
        // left edge, bottom -> top
        const d3 = dist - (w + h + w);
        left = -strokeThickness / 2;
        top = Math.max(-strokeThickness / 2, h - d3 - L / 2);
        width = strokeThickness;
        height = L;
      }

      setStrokeStyle({ left: Math.round(left), top: Math.round(top), width, height });
    });

    Animated.sequence([
      Animated.delay(400),
      Animated.timing(borderOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(borderOpacityAnim, { toValue: 0, duration: 1200, delay: 400, useNativeDriver: false })
    ]).start(() => {
      try { progress.removeListener(listenerId); } catch (e) {}
      setStrokeStyle({ left: -50, top: -50, width: 0, height: 0 });
    });

    return () => {
      try { progress.removeListener(listenerId); } catch (e) {}
    };
  }, [greeting, boxLayout, progress, borderOpacityAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // start responding only if horizontal swipe is stronger than vertical
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gesture) => {
        const threshold = 50; // minimal pixels to consider a swipe
        if (gesture.dx < -threshold) {
          changeMonth(1);
        } else if (gesture.dx > threshold) {
          changeMonth(-1);
        }
      },
    })
  ).current;

  const toggleTodoCompletion = (todoId: string) => {
    const todoIndex = todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) return;
    
    const todo = todos[todoIndex];
    if (!todo.completed) {
      // Wenn gerade abgehakt wird
      const newTodos = [...todos];
      
      // Animation Value erstellen
      if (!fadeOutAnimRef.current[todoId]) {
        fadeOutAnimRef.current[todoId] = new Animated.Value(1);
      }
      
      newTodos[todoIndex] = { ...todo, completed: true, fadeOutAnim: fadeOutAnimRef.current[todoId] };
      setTodos(newTodos);
      
      // Nach 2 Sekunden ausblenden
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(fadeOutAnimRef.current[todoId], {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: false
          }),
          Animated.delay(100)
        ]).start(() => {
          // Nach Animation komplett entfernen
          setTodos(prevTodos => prevTodos.filter(t => t.id !== todoId));
          delete fadeOutAnimRef.current[todoId];
        });
      }, 2000);
    } else {
      // Einfach toggen wenn es nur un-marked wird
      setTodos(prevTodos =>
        prevTodos.map(t =>
          t.id === todoId ? { ...t, completed: !t.completed } : t
        )
      );
    }
  };

  const getTimeUntilReminder = (reminderTime: string | undefined): string | null => {
    if (!reminderTime) return null;
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const reminder = new Date();
    reminder.setHours(hours, minutes, 0, 0);
    const now = new Date();
    const diff = reminder.getTime() - now.getTime();
    
    if (diff <= 0) return 'Überfällig';
    
    const totalMinutes = Math.floor(diff / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    
    if (h === 0) {
      return `fällig in ${m}m`;
    } else if (m === 0) {
      return `fällig in ${h}h`;
    } else {
      return `fällig in ${h}h ${m}m`;
    }
  };

  const formatElapsed = (totalSeconds: number) => {
    let s = totalSeconds;
    let hours = Math.floor(s / 3600);
    s = s % 3600;
    let minutes = Math.floor(s / 60);
    let seconds = s % 60;

    // Round seconds to minutes if >= 30s
    if (seconds >= 30) {
      minutes += 1;
      seconds = 0;
    }

    // If minutes roll over to hours
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }

    // Special rounding: if minutes >= 50, round up to next hour
    if (minutes >= 50) {
      hours += 1;
      minutes = 0;
    }

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    if (minutes > 0) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    return `${seconds}s`;
  };

  const changeMonth = (offset: number) => {
    const oldDay = selectedDate.getDate();
    const newMonth = selectedDate.getMonth() + offset;
    const newYear = selectedDate.getFullYear();
    const candidate = new Date(newYear, newMonth, 1);
    const daysInNewMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    const day = Math.min(oldDay, daysInNewMonth);
    const newDate = new Date(candidate.getFullYear(), candidate.getMonth(), day);
    setSelectedDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  const addEvent = (eventName: string) => {
    const dateKey = selectedDate.toLocaleDateString('de-DE');
    setEvents(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), { time: eventTime, description: eventDescription }]
    }));
    setShowAddEvent(false);
    setEventTime('');
    setEventDescription('');
    setLastUpdated(new Date());
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDay = getFirstDayOfMonth(selectedDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDate.getDate();
      const isTodayDate = isToday(day);
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isSelected && styles.calendarDaySelected,
            isTodayDate && styles.calendarDayToday
          ]}
          onPress={() => {
            const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            setSelectedDate(newDate);
          }}
        >
          <Text style={[
            styles.calendarDayText,
            isSelected && styles.calendarDayTextSelected,
            isTodayDate && styles.calendarDayTextToday
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const currentMonth = monthNames[selectedDate.getMonth()];
  const currentYear = selectedDate.getFullYear();

  // build months list from Nov 2025 through Dec 2026
  const monthsList: { year: number; month: number; label: string }[] = [];
  const start = new Date(2025, 10, 1); // November 2025 (month index 10)
  const end = new Date(2026, 11, 1); // December 2026
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const startMonth = y === start.getFullYear() ? start.getMonth() : 0;
    const endMonth = y === end.getFullYear() ? end.getMonth() : 11;
    for (let m = startMonth; m <= endMonth; m++) {
      monthsList.push({ year: y, month: m, label: `${monthNames[m].substring(0,3)} ${String(y).slice(-2)}` });
    }
  }

  const selectMonthFromBar = (year: number, monthIndex: number) => {
    const oldDay = selectedDate.getDate();
    const daysInNewMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(oldDay, daysInNewMonth);
    setSelectedDate(new Date(year, monthIndex, day));
  };

  const renderContent = () => {
    // Login Screen
    if (authStage === 'login') {
      return (
        <View style={styles.authContainer}>
          <View style={styles.authScreen}>
            <Text style={styles.authTitle}>Cleanquest</Text>
            <Text style={styles.authSubtitle}>Login</Text>
            
            <TextInput
              style={styles.authInput}
              placeholder="Benutzername"
              value={loginUsername}
              onChangeText={setLoginUsername}
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Passwort"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry
              placeholderTextColor="#999"
            />
            
            {loginError ? (
              <View style={styles.errorMessage}>
                <Text style={styles.errorText}>{loginError}</Text>
              </View>
            ) : null}
            
            <TouchableOpacity 
              style={styles.authButton}
              onPress={handleLogin}
            >
              <Text style={styles.authButtonText}>Anmelden</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.authButtonSecondary}
              onPress={() => setAuthStage('accountRegistration')}
            >
              <Text style={styles.authButtonSecondaryText}>Konto erstellen</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Account Registration Screen
    if (authStage === 'accountRegistration') {
      return (
        <View style={styles.authContainer}>
          <View style={styles.authScreen}>
            <Text style={styles.authTitle}>Cleanquest</Text>
            <Text style={styles.authSubtitle}>Konto erstellen</Text>
            
            <TextInput
              style={styles.authInput}
              placeholder="Benutzername"
              value={regUsername}
              onChangeText={setRegUsername}
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Passwort (min. 4 Zeichen)"
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Passwort bestätigen"
              value={regPasswordConfirm}
              onChangeText={setRegPasswordConfirm}
              secureTextEntry
              placeholderTextColor="#999"
            />
            
            {regError ? (
              <View style={styles.errorMessage}>
                <Text style={styles.errorText}>{regError}</Text>
              </View>
            ) : null}
            
            {regSuccess ? (
              <View style={styles.successMessage}>
                <Text style={styles.successText}>{regSuccess}</Text>
              </View>
            ) : null}
            
            <TouchableOpacity 
              style={styles.authButton}
              onPress={handleRegisterAccount}
            >
              <Text style={styles.authButtonText}>Registrieren</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.authButtonSecondary}
              onPress={() => {
                setAuthStage('login');
                setRegUsername('');
                setRegPassword('');
                setRegPasswordConfirm('');
                setRegError('');
                setRegSuccess('');
              }}
            >
              <Text style={styles.authButtonSecondaryText}>← Zurück zum Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // If not logged in, show auth screens
    if (authStage !== 'app') {
      return (
        <ScrollView style={styles.authContainer}>
          {/* Family Selection Screen - START */}
          {authStage === 'familySelection' && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>Cleanquest</Text>
              <Text style={styles.authSubtitle}>Willkommen!</Text>
              <Text style={styles.authDescription}>Wähle eine Option:</Text>
              
              <TouchableOpacity 
                style={styles.familyOptionButton}
                onPress={() => setAuthStage('createFamily')}
              >
                <Text style={styles.familyOptionText}>➕ Neue Familie erstellen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.familyOptionButton}
                onPress={() => setAuthStage('joinFamily')}
              >
                <Text style={styles.familyOptionText}>🔗 Familie mit Code beitreten</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.authButtonSecondary}
                onPress={() => setAuthStage('login')}
              >
                <Text style={styles.authButtonSecondaryText}>← Zurück zum Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Create Family Screen */}
          {authStage === 'createFamily' && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>Neue Familie</Text>
              
              <TextInput
                style={styles.authInput}
                placeholder="Familienname"
                value={familyName}
                onChangeText={setFamilyName}
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleCreateFamily}
              >
                <Text style={styles.authButtonText}>Familie erstellen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.authButtonSecondary}
                onPress={() => setAuthStage('familySelection')}
              >
                <Text style={styles.authButtonSecondaryText}>Zurück</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Join Family Screen */}
          {authStage === 'joinFamily' && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>Familie beitreten</Text>
              
              <TextInput
                style={styles.authInput}
                placeholder="Familien-Code oder Link einfügen"
                value={joinCode}
                onChangeText={(text) => { setJoinCode(text); setJoinError(''); }}
                placeholderTextColor="#999"
                multiline
              />
              
              {joinError && (
                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>⚠️ {joinError}</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleJoinFamily}
              >
                <Text style={styles.authButtonText}>Beitreten</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.authButtonSecondary}
                onPress={() => { setAuthStage('familySelection'); setJoinError(''); }}
              >
                <Text style={styles.authButtonSecondaryText}>Zurück</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show Family Code Screen */}
          {authStage === 'showCode' && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>✅ Familie erstellt!</Text>
              <Text style={styles.codeSubtitle}>Dein Familien-Code:</Text>
              
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{generatedCode}</Text>
              </View>
              
              <Text style={styles.codeDescription}>
                Teile diesen Code mit deinen Familienmitgliedern oder nutze den Link unten.
              </Text>
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={() => {
                  // Copy code to clipboard
                  if (typeof window !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(generatedCode).then(() => {
                      setCopiedMessage('Code kopiert! ✓');
                      setTimeout(() => setCopiedMessage(''), 3000);
                    });
                  } else {
                    // Fallback for environments without clipboard API
                    alert('Code: ' + generatedCode);
                  }
                }}
              >
                <Text style={styles.authButtonText}>📋 Code kopieren</Text>
              </TouchableOpacity>

              {copiedMessage === 'Code kopiert! ✓' && (
                <View style={styles.successMessage}>
                  <Text style={styles.successText}>Code kopiert! ✓</Text>
                </View>
              )}

              <Text style={styles.codeSubtitle}>Oder teile diesen Link:</Text>
              
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={3}>{sharingLink}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={() => {
                  // Copy link to clipboard
                  if (typeof window !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(sharingLink).then(() => {
                      setCopiedMessage('Link kopiert! ✓');
                      setTimeout(() => setCopiedMessage(''), 3000);
                    });
                  } else {
                    // Fallback for environments without clipboard API
                    alert('Link: ' + sharingLink);
                  }
                }}
              >
                <Text style={styles.authButtonText}>🔗 Link kopieren</Text>
              </TouchableOpacity>

              {copiedMessage === 'Link kopiert! ✓' && (
                <View style={styles.successMessage}>
                  <Text style={styles.successText}>Link kopiert! ✓</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleProceedAfterCode}
              >
                <Text style={styles.authButtonText}>Weiter →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Register Screen */}
          {authStage === 'register' && currentFamily && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>Registrierung</Text>
              <Text style={styles.familyNameDisplay}>Familie: {currentFamily.name}</Text>
              
              <TextInput
                style={styles.authInput}
                placeholder="Benutzername"
                value={username}
                onChangeText={setUsername}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Passwort"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Alter"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleRegister}
              >
                <Text style={styles.authButtonText}>Registrieren</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Questionnaire Screen */}
          {authStage === 'questionnaire' && (
            <View style={styles.authScreen}>
              <Text style={styles.authTitle}>Verfügbarkeit & Stärken</Text>
              
              <Text style={styles.questionnaireSection}>Deine Verfügbarkeit:</Text>
              {availability.map((day, index) => (
                <View key={day.day} style={styles.dayAvailability}>
                  <Text style={styles.dayName}>{day.day}</Text>
                  <View style={styles.hoursContainer}>
                    {['06-12', '12-18', '18-24'].map(period => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.hourButton,
                          day.hours.includes(period) && styles.hourButtonActive
                        ]}
                        onPress={() => {
                          const newHours = day.hours.includes(period)
                            ? day.hours.filter(h => h !== period)
                            : [...day.hours, period];
                          updateAvailability(index, newHours);
                        }}
                      >
                        <Text style={[
                          styles.hourButtonText,
                          day.hours.includes(period) && styles.hourButtonTextActive
                        ]}>
                          {period}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              
              <Text style={styles.questionnaireSection}>Deine Hausstärken:</Text>
              {strengths.map(strength => (
                <View key={strength.id} style={styles.strengthItem}>
                  <Text style={styles.strengthName}>{strength.name}</Text>
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <TouchableOpacity
                        key={rating}
                        style={[
                          styles.ratingButton,
                          strength.rating >= rating && styles.ratingButtonActive
                        ]}
                        onPress={() => updateStrengthRating(strength.id, rating)}
                      >
                        <Text style={[
                          styles.ratingButtonText,
                          strength.rating >= rating && styles.ratingButtonTextActive
                        ]}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleQuestionnaireComplete}
              >
                <Text style={styles.authButtonText}>Fertig</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      );
    }

    // Original app content
    switch (activeTab) {
      case 0:
        return (
          <View {...panResponder.panHandlers} style={styles.calendarContainer}>
            <ScrollView>
            <Text style={styles.calendarTitle}>{currentMonth} {currentYear}</Text>

            {/* Months swipebar (Nov 2025 -> Dec 2026) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsBar}>
              {monthsList.map((m, idx) => {
                const isActive = m.year === selectedDate.getFullYear() && m.month === selectedDate.getMonth();
                return (
                  <TouchableOpacity key={`${m.year}-${m.month}`} style={[styles.monthChip, isActive && styles.monthChipActive]} onPress={() => selectMonthFromBar(m.year, m.month)}>
                    <Text style={[styles.monthChipText, isActive && styles.monthChipTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.weekDaysHeader}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <Text key={day} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {renderCalendarDays()}
            </View>

            <Text style={styles.selectedDateText}>
              Ausgewähltes Datum: {selectedDate.toLocaleDateString('de-DE')}
            </Text>
            </ScrollView>
          </View>
        );
      case 1:
        return (
          <View style={styles.todoContainer}>
            <View style={styles.todoHeader}>
              <Text style={styles.todoTitle}>Meine Quests</Text>
              <TouchableOpacity 
                style={styles.todoAddButton}
                onPress={() => setShowAddTodo(!showAddTodo)}
              >
                <Text style={styles.todoAddButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            {showAddTodo && (
              <View style={styles.todoInputContainer}>
                <View style={styles.todoInputColumn}>
                  <TextInput
                    style={styles.todoInput}
                    placeholder="Neue Quest..."
                    value={newTodoText}
                    onChangeText={setNewTodoText}
                    placeholderTextColor="#999"
                  />
                  <TextInput
                    style={styles.todoInput}
                    placeholder="Uhrzeit (z.B. 14:30)"
                    value={newTodoReminder}
                    onChangeText={setNewTodoReminder}
                    placeholderTextColor="#999"
                  />
                </View>
                <TouchableOpacity
                  style={styles.todoSaveButton}
                  onPress={() => {
                    if (newTodoText.trim()) {
                      setTodos(prev => [...prev, { 
                        id: Date.now().toString(), 
                        text: newTodoText, 
                        completed: false,
                        reminderTime: newTodoReminder
                      }]);
                      setNewTodoText('');
                      setNewTodoReminder('');
                      setShowAddTodo(false);
                    }
                  }}
                >
                  <Text style={styles.todoSaveButtonText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.todoList}>
              {todos.length === 0 ? (
                <Text style={styles.emptyTodoText}>Keine Quests vorhanden. Erstellen Sie eine neue!</Text>
              ) : (
                todos.map(todo => {
                  const timeRemaining = getTimeUntilReminder(todo.reminderTime);
                  const opacityAnim = todo.fadeOutAnim || new Animated.Value(1);
                  return (
                    <Animated.View 
                      key={todo.id} 
                      style={[
                        styles.todoItem,
                        {
                          opacity: opacityAnim,
                          transform: [
                            {
                              scale: opacityAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1]
                              })
                            }
                          ]
                        }
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.todoCheckbox}
                        onPress={() => toggleTodoCompletion(todo.id)}
                      >
                        <Text style={styles.todoCheckboxText}>
                          {todo.completed ? '✓' : '○'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.todoTextContent}>
                        <Text
                          style={[
                            styles.todoItemText,
                            todo.completed && styles.todoItemTextCompleted
                          ]}
                        >
                          {todo.text}
                        </Text>
                        {timeRemaining && (
                          <Text style={[
                            styles.todoReminder,
                            timeRemaining === 'Überfällig' && styles.todoReminderOverdue
                          ]}>
                            {timeRemaining}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.todoDeleteButton}
                        onPress={() => {
                          setTodos(prev => prev.filter(t => t.id !== todo.id));
                        }}
                      >
                        <Text style={styles.todoDeleteButtonText}>×</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })
              )}
            </ScrollView>
          </View>
        );
      case 2:
        return (
          <View style={styles.homeContainer}>
            <View
              style={styles.greetingBox}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setBoxLayout({ width, height });
              }}
            >
              <Text style={styles.greetingText}>{greeting}</Text>

              {/* animated full-border that appears after dot completes */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.borderOverlay,
                  { opacity: borderOpacityAnim }
                ]}
              />

              {/* moving stroke that traces around the box once */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: strokeStyle.left,
                  top: strokeStyle.top,
                  width: strokeStyle.width,
                  height: strokeStyle.height,
                  backgroundColor: '#FF6B6B',
                  borderRadius: 4,
                  elevation: 6,
                }}
              />
            </View>
            <View style={styles.homeContent}>
              <Text style={styles.contentText}>Willkommen, {currentUser?.username}!</Text>
              <Text style={styles.familyText}>Familie: {currentFamily?.name}</Text>
            </View>
          </View>
        );
      case 3:
        return <Text style={styles.contentText}>Einkaufen</Text>;
      case 4:
        return (
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>{currentFamily?.name} Chat</Text>
            </View>
            
            <ScrollView style={styles.chatMessages}>
              {chatMessages.length === 0 ? (
                <Text style={styles.emptyChatText}>Keine Nachrichten. Starten Sie ein Gespräch!</Text>
              ) : (
                chatMessages.map(msg => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatMessage,
                      msg.sender === currentUser?.username && styles.chatMessageOwn
                    ]}
                  >
                    {msg.sender !== currentUser?.username && (
                      <Text style={styles.chatSender}>{msg.sender}</Text>
                    )}
                    <View style={[
                      styles.chatBubble,
                      msg.sender === currentUser?.username && styles.chatBubbleOwn
                    ]}>
                      <Text style={[
                        styles.chatText,
                        msg.sender === currentUser?.username && styles.chatTextOwn
                      ]}>
                        {msg.text}
                      </Text>
                    </View>
                    <Text style={styles.chatTime}>
                      {msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Nachricht..."
                value={newMessage}
                onChangeText={setNewMessage}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={sendChatMessage}
              >
                <Text style={styles.chatSendButtonText}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return <Text style={styles.contentText}>Startseite</Text>;
    }
  };

  return (
    <View style={styles.container}>
      {
        (() => {
          const seconds = Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000));
          const text = formatElapsed(seconds);
          return (
            <View style={styles.updateIndicator}>
              <Text style={styles.updateText}>Seit {text}</Text>
            </View>
          );
        })()
      }
      <View style={styles.content}>
        {renderContent()}
        
        {/* Family Management Button - Top Right */}
        {authStage === 'app' && (
          <TouchableOpacity 
            style={styles.familyManagementButton}
            onPress={() => setShowFamilyModal(true)}
          >
            <Text style={styles.familyManagementButtonText}>👨‍👩‍👧‍👦</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Family Management Modal */}
      {showFamilyModal && authStage === 'app' && (
        <Modal
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFamilyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏠 Familie verwalten</Text>
              
              {currentFamily ? (
                <>
                  <Text style={styles.familyDisplayText}>Aktuelle Familie: <Text style={{ fontWeight: 'bold' }}>{currentFamily.name}</Text></Text>
                  <Text style={styles.familyCodeDisplay}>Code: <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{currentFamily.code}</Text></Text>
                  
                  <TouchableOpacity 
                    style={styles.modalButtonSave}
                    onPress={() => {
                      if (typeof window !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(currentFamily.code).then(() => {
                          alert('Code kopiert!');
                        });
                      }
                    }}
                  >
                    <Text style={styles.modalButtonText}>📋 Code kopieren</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.modalButtonCancel}
                    onPress={() => setShowFamilyModal(false)}
                  >
                    <Text style={styles.modalButtonCancelText}>Schließen</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.modalButtonSave}
                    onPress={() => {
                      setShowFamilyModal(false);
                      setAuthStage('createFamily');
                    }}
                  >
                    <Text style={styles.modalButtonText}>➕ Neue Familie erstellen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.modalButtonSave}
                    onPress={() => {
                      setShowFamilyModal(false);
                      setAuthStage('joinFamily');
                    }}
                  >
                    <Text style={styles.modalButtonText}>🔗 Familie mit Code beitreten</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.modalButtonCancel}
                    onPress={() => setShowFamilyModal(false)}
                  >
                    <Text style={styles.modalButtonCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity 
                style={[styles.modalButtonCancel, { marginTop: 16, backgroundColor: '#FFE5E5' }]}
                onPress={handleLogout}
              >
                <Text style={[styles.modalButtonCancelText, { color: '#FF6B6B' }]}>🚪 Abmelden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 0 && styles.navItemActive]}
          onPress={() => setActiveTab(0)}
        >
          <Text style={[styles.navText, activeTab === 0 && styles.navTextActive]}>📅</Text>
          <Text style={[styles.navLabel, activeTab === 0 && styles.navLabelActive]}>Kalender</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 1 && styles.navItemActive]}
          onPress={() => setActiveTab(1)}
        >
          <Text style={[styles.navText, activeTab === 1 && styles.navTextActive]}>✓</Text>
          <Text style={[styles.navLabel, activeTab === 1 && styles.navLabelActive]}>To-Dos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, styles.navItemCenter, activeTab === 2 && styles.navItemActive]}
          onPress={() => setActiveTab(2)}
        >
          <Text style={[styles.navText, styles.navTextCenter, activeTab === 2 && styles.navTextActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 2 && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 3 && styles.navItemActive]}
          onPress={() => setActiveTab(3)}
        >
          <Text style={[styles.navText, activeTab === 3 && styles.navTextActive]}>🛒</Text>
          <Text style={[styles.navLabel, activeTab === 3 && styles.navLabelActive]}>Einkaufen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 4 && styles.navItemActive]}
          onPress={() => setActiveTab(4)}
        >
          <Text style={[styles.navText, activeTab === 4 && styles.navTextActive]}>�</Text>
          <Text style={[styles.navLabel, activeTab === 4 && styles.navLabelActive]}>Chat</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 0 && (
        <TouchableOpacity
          style={styles.addEventButton}
          onPress={() => setShowAddEvent(!showAddEvent)}
        >
          <Text style={styles.addEventButtonText}>+</Text>
        </TouchableOpacity>
      )}

      {showAddEvent && activeTab === 0 && (
        <Modal
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddEvent(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Event hinzufügen</Text>
              
              <Text style={styles.modalLabel}>Datum:</Text>
              <Text style={styles.modalDateText}>
                {selectedDate.toLocaleDateString('de-DE')}
              </Text>

              <Text style={styles.modalLabel}>Uhrzeit:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="z.B. 14:30"
                value={eventTime}
                onChangeText={setEventTime}
                placeholderTextColor="#999"
              />

              <Text style={styles.modalLabel}>Beschreibung:</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputLarge]}
                placeholder="Was passiert?"
                value={eventDescription}
                onChangeText={setEventDescription}
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={styles.modalButtonSave}
                  onPress={() => addEvent('Event')}
                >
                  <Text style={styles.modalButtonText}>Speichern</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setShowAddEvent(false);
                    setEventTime('');
                    setEventDescription('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {activeTab === 0 && (
        <View style={styles.eventsDisplay}>
          {events[selectedDate.toLocaleDateString('de-DE')] && events[selectedDate.toLocaleDateString('de-DE')].length > 0 && (
            <View style={styles.eventsContainer}>
              <Text style={styles.eventsTitle}>Events:</Text>
              {events[selectedDate.toLocaleDateString('de-DE')].map((event, index) => (
                <View key={index} style={styles.eventItem}>
                  <Text style={styles.eventTime}>{event.time}</Text>
                  <Text style={styles.eventDescription}>{event.description}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: 'relative',
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E7ED",
  },
  contentText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  /* Auth Styles */
  authContainer: {
    flex: 1,
    backgroundColor: '#E2E7ED',
    paddingTop: 20,
  },
  authScreen: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    elevation: 3,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  authDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  familyNameDisplay: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
    fontWeight: '600',
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    backgroundColor: '#F9F9F9',
  },
  authButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  authButtonSecondary: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  authButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  familySelectionScreen: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    elevation: 3,
  },
  familyOptionButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
  },
  familyOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  codeBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 4,
  },
  linkBox: {
    backgroundColor: '#E8F4F8',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: '#4DA6FF',
    minHeight: 60,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '500',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  codeSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  codeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorMessage: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  questionnaireSection: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  dayAvailability: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hourButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  hourButtonActive: {
    backgroundColor: '#FFD700',
  },
  hourButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
  },
  hourButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  strengthItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  ratingButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  ratingButtonActive: {
    // no additional styling needed
  },
  ratingButtonText: {
    fontSize: 18,
    color: '#CCC',
  },
  ratingButtonTextActive: {
    color: '#FFD700',
  },
  /* Chat Styles */
  chatContainer: {
    flex: 1,
    backgroundColor: '#E2E7ED',
  },
  chatHeader: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginTop: 50,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  chatMessage: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  chatMessageOwn: {
    alignItems: 'flex-end',
  },
  chatSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667',
    marginBottom: 4,
    marginLeft: 12,
  },
  chatBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '80%',
    elevation: 1,
  },
  chatBubbleOwn: {
    backgroundColor: '#FFD700',
  },
  chatText: {
    fontSize: 14,
    color: '#333',
  },
  chatTextOwn: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  chatTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 12,
  },
  chatInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
  },
  chatSendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFD700',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    fontSize: 18,
  },
  familyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  bottomNav: {
    flexDirection: "row",
    height: 90,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    paddingHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: "#F0F0F0",
  },
  navText: {
    fontSize: 24,
    color: "#999",
  },
  navTextActive: {
    color: "#FFD700",
  },
  navLabel: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  navLabelActive: {
    color: "#FFD700",
    fontWeight: "bold",
  },
  navItemCenter: {
    paddingBottom: 0,
  },
  navTextCenter: {
    fontSize: 32,
  },
  calendarContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 55,
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    justifyContent: 'space-around',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  calendarDaySelected: {
    backgroundColor: '#FFD700',
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  selectedDateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  addEventButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addEventButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  calendarDayToday: {
    borderWidth: 3,
    borderColor: '#FF6B6B',
    backgroundColor: '#FFE5E5',
  },
  calendarDayTextToday: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  addEventModal: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    minWidth: 150,
  },
  addEventModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  addEventOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    marginBottom: 8,
  },
  addEventOptionText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  modalDateText: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  modalInputLarge: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButtonSave: {
    flex: 1,
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  eventsDisplay: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    maxHeight: 200,
  },
  eventsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  eventItem: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    color: '#333',
  },
  monthsBar: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  monthChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  monthChipActive: {
    backgroundColor: '#FFD700',
  },
  monthChipText: {
    fontSize: 12,
    color: '#333',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  updateIndicator: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  updateDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#FF4D4D',
    marginBottom: 8,
  },
  updateText: { 
    fontSize: 14,
    color: '#FF4D4D',
    fontWeight: '600',
  },
  /* Home greeting */
  homeContainer: {
    flex: 1,
    width: '100%',
    paddingTop: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#E2E7ED',
  },
  greetingBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginTop: 40,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  borderOverlay: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  dot: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    elevation: 6,
  },
  homeContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: '#E2E7ED',
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 50,
  },
  todoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  todoAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  todoAddButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  todoInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'flex-start',
  },
  todoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  todoSaveButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  todoList: {
    flex: 1,
  },
  emptyTodoText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  todoItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    opacity: 1,
  },
  todoCheckbox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  todoCheckboxText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  todoItemText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  todoItemTextCompleted: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  todoDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  todoDeleteButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  todoInputColumn: {
    flex: 1,
    marginRight: 8,
  },
  todoTextContent: {
    flex: 1,
  },
  todoReminder: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 4,
  },
  todoReminderOverdue: {
    color: '#FF6B6B',
  },
  successMessage: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    alignItems: 'center',
  },
  successText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  /* Family Management */
  familyManagementButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  familyManagementButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  familyDisplayText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  familyCodeDisplay: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontFamily: 'monospace',
  },});