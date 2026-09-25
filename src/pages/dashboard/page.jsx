// DashboardPage.tsx - Ultimate Premium macOS/iOS Inspired Dashboard
import { useState, useCallback, useContext, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import AppLayout from '@/components/feature/AppLayout';
import { KissflowSDKContext, kf } from '@/sdk/index.js';
import KPISection from './components/KPISection';
import ProjectHealthTable from './components/ProjectHealthTable';
import SubtaskTable from './components/SubtaskTable';
import DelayRevisionSection from './components/DelayRevisionSection';
import RAGSummaryBar from './components/RAGSummaryBar';
import ProjectDrillDownModal from './components/ProjectDrillDownModal';

import { resolveKissflowAccountId, resolveKissflowOrigin, kfGetJson, fetchAllAdminProcessItems, KF_ADMIN_PAGE_SIZE } from '../../lib/kfRuntime.js'

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
const CASE_ID = 'Project_Management_A01';

const BASE_URL = resolveKissflowOrigin();

// ============ PREMIUM COLOR PALETTE ============
const colors = {
  primary: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
    400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
    800: '#1e40af', 900: '#1e3a8a',
  },
  accent: {
    purple: '#8b5cf6', pink: '#ec4899', orange: '#f59e0b',
    emerald: '#10b981', rose: '#f43f5e', cyan: '#06b6d4',
  }
};

// ============ MACOS WINDOW CONTROLS HOOK ============
const useMacOSWindow = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: '100%', height: 'auto' });

  const handleMinimize = () => {
    setIsMinimized(true);
    setTimeout(() => setIsMinimized(false), 350);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    setWindowSize(isMaximized ? { width: '100%', height: 'auto' } : { width: '98%', height: '95vh' });
  };

  return { isMinimized, isMaximized, windowSize, handleMinimize, handleMaximize };
};

// ============ PREMIUM DOCK COMPONENT ============
const PremiumDock = ({ items, activeItem, onItemClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(0);
  const dockRef = useRef(null);

  return (
    <motion.div
      ref={dockRef}
      className="fixed bottom-8 left-1/2 z-50"
      style={{ x: '-50%' }}
      initial={{ y: 120, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280, delay: 0.2 }}
    >
      <div className="relative">
        {/* Dock Background with Glassmorphism */}
        <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-xl shadow-2xl" />
        <div className="relative flex items-end gap-2 px-4 py-3">
          {items.map((item, index) => {
            const isHovered = hoveredIndex === index;
            const scale = isHovered ? 1.15 : 1;
            const yOffset = isHovered ? -12 : 0;
            
            return (
              <motion.button
                key={item.key}
                onClick={() => onItemClick(item.key)}
                onMouseEnter={() => {
                  setHoveredIndex(index);
                  const rect = dockRef.current?.getBoundingClientRect();
                  if (rect) setHoveredPosition(index * 70);
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                animate={{ y: yOffset, scale }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative group"
              >
                {/* Dock Icon Container */}
                <div className={`
                  relative w-14 h-14 rounded-xl flex items-center justify-center transition-all
                  ${activeItem === item.key 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/30' 
                    : 'bg-gray-100 hover:bg-gray-200'
                  }
                `}>
                  <i className={`${item.icon} text-xl ${activeItem === item.key ? 'text-white' : 'text-gray-600'}`} />
                  
                  {/* Active Indicator */}
                  {activeItem === item.key && (
                    <motion.div
                      layoutId="activeDockLight"
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring' }}
                    />
                  )}
                </div>
                
                {/* Tooltip */}
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? -30 : 5 }}
                  className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
        
        {/* Dock Reflection */}
        <div className="absolute -bottom-1 left-0 right-0 h-4 bg-gradient-to-t from-white/20 to-transparent rounded-b-2xl" />
      </div>
    </motion.div>
  );
};

// ============ BOUNCY MODAL WITH MACOS CONTROLS ============
const BouncyMacOSModal = ({ isOpen, onClose, children, title }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '10px';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0';
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
      setIsAnimating(false);
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
            onClick={handleClose}
          />
          
          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ 
              scale: 0.3,
              opacity: 0,
              y: 200,
              rotateX: -45,
              rotateZ: -10
            }}
            animate={{ 
              scale: 1,
              opacity: 1,
              y: 0,
              rotateX: 0,
              rotateZ: 0
            }}
            exit={{ 
              scale: 0.3,
              opacity: 0,
              y: 200,
              rotateX: -45,
              rotateZ: -10
            }}
            transition={{ 
              type: 'spring',
              damping: 18,
              stiffness: 280,
              mass: 0.8
            }}
            className="fixed top-1/2 left-1/2 z-[101] w-full max-w-5xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* macOS Window Header with Traffic Lights */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200/50 px-4 py-3.5 flex items-center">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClose}
                    className="group relative w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[8px] font-bold">✕</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="group relative w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[8px] font-bold">−</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="group relative w-3.5 h-3.5 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[8px] font-bold">+</span>
                  </motion.button>
                </div>
                <h3 className="flex-1 text-center text-sm font-semibold text-gray-800">{title}</h3>
                <div className="w-20" />
            </div>
              
              {/* Modal Content with Spring Scroll */}
              <motion.div 
                className="overflow-y-auto max-h-[calc(85vh-55px)] p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {children}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============ ANIMATED KPI CARD ============
const AnimatedKPICard = ({ title, value, icon, trend, color, delay, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={{ 
        y: -6,
        scale: 1.02,
        transition: { type: 'spring', stiffness: 400, damping: 25 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      {/* Animated Gradient Border */}
      <motion.div
        className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-500"
        animate={{ opacity: isHovered ? 0.3 : 0 }}
      />
      
      <div className="relative bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden">
        {/* Animated Background Gradient */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
        />
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <motion.div 
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <i className={`${icon} text-white text-xl`} />
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.15, type: 'spring' }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50"
            >
              <i className="ri-arrow-up-line text-emerald-600 text-xs" />
              <span className="text-xs font-medium text-emerald-600">{trend}</span>
            </motion.div>
          </div>

          <motion.h3 
            className="text-3xl font-bold text-gray-800 mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.1 }}
          >
            {value}
          </motion.h3>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          </div>

        {/* Animated Bottom Bar */}
        <motion.div
          className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${color}`}
          initial={{ width: '0%' }}
          whileHover={{ width: '100%' }}
          transition={{ type: 'spring', stiffness: 400 }}
        />
      </div>
    </motion.div>
  );
};

// ============ GLASSMORPHISM HEADER ============
const GlassHeader = ({ userName, roleName, onMinimize, onMaximize, isMaximized }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [0.8, 0.95]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit' 
  });
  const dateString = currentTime.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric' 
  });

  return (
    <motion.div
      style={{ opacity: headerOpacity }}
      className={`sticky top-0 z-40 transition-all duration-500 ${
        scrolled 
          ? 'bg-white/90 backdrop-blur-xl shadow-xl' 
          : 'bg-white/60 backdrop-blur-md'
      } border-b border-white/30`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* macOS Traffic Lights */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onMinimize}
              className="group relative w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[7px] font-bold">−</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onMaximize}
              className="group relative w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[7px] font-bold">
                {isMaximized ? '□' : '□'}
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="group relative w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[7px] font-bold">+</span>
            </motion.button>
          </div>

          {/* Logo with Animation */}
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg"
            >
              <i className="ri-command-line text-white text-base" />
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Command Center
              </h1>
              <p className="text-[10px] text-gray-400">Enterprise Intelligence</p>
            </div>
          </motion.div>

          {/* Center - Date & Time */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex items-center gap-4 px-4 py-1.5 rounded-full bg-gray-100/80 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <motion.div 
                className="w-2 h-2 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <span className="text-xs text-gray-600 font-medium">Live</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-2">
              <i className="ri-calendar-line text-gray-400 text-xs" />
              <span className="text-xs text-gray-700">{dateString}</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-2">
              <i className="ri-time-line text-gray-400 text-xs" />
              <span className="text-xs text-gray-700 font-medium">{timeString}</span>
        </div>
          </motion.div>

          {/* User Profile with Spring Animation */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 cursor-pointer shadow-sm"
          >
            <motion.div 
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-md"
              whileHover={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <span className="text-white text-sm font-semibold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </motion.div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">{userName}</p>
              <p className="text-xs text-gray-500">{roleName}</p>
            </div>
            <i className="ri-arrow-down-s-line text-gray-400 text-sm" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

// ============ ANIMATED SECTION TABS ============
const AnimatedSectionTabs = ({ sections, activeSection, onSectionChange }) => {
  const [hoveredKey, setHoveredKey] = useState(null);
  
  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100/50 backdrop-blur-sm rounded-2xl">
        {sections.map((section) => (
          <motion.button
            key={section.key}
            onClick={() => onSectionChange(section.key)}
            onHoverStart={() => setHoveredKey(section.key)}
            onHoverEnd={() => setHoveredKey(null)}
            className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all z-10"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            {activeSection === section.key && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl shadow-lg"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <motion.i 
              className={`${section.icon} relative z-10 text-base transition-all`}
              animate={{ 
                scale: hoveredKey === section.key ? 1.1 : 1,
                color: activeSection === section.key ? '#fff' : '#6b7280'
              }}
            />
            <span className={`relative z-10 hidden sm:inline transition-colors ${
              activeSection === section.key ? 'text-white font-semibold' : 'text-gray-600'
            }`}>
              {section.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ============ PREMIUM CARD WITH SPRING HOVER ============
const PremiumCard = ({ children, className, gradient = false, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -6,
        transition: { type: 'spring', stiffness: 400, damping: 25 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className="relative cursor-pointer"
    >
      <motion.div
        className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0"
        animate={{ opacity: isHovered ? 0.2 : 0 }}
        transition={{ duration: 0.3 }}
      />
      <div className={`relative bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl overflow-hidden ${className}`}>
        {children}
      </div>
    </motion.div>
  );
};

// ============ FLOATING ACTION BUTTON ============
const FloatingActionButton = ({ onClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const actions = [
    { icon: 'ri-file-excel-line', label: 'Export CSV', color: 'from-green-500 to-emerald-500' },
    { icon: 'ri-file-pdf-line', label: 'Export PDF', color: 'from-red-500 to-rose-500' },
    { icon: 'ri-share-line', label: 'Share', color: 'from-blue-500 to-cyan-500' },
    { icon: 'ri-refresh-line', label: 'Refresh', color: 'from-purple-500 to-pink-500' },
  ];
  
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && actions.map((action, index) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: 20 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
            whileHover={{ scale: 1.05, x: -5 }}
            onClick={onClick}
            className="absolute right-0 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-lg whitespace-nowrap"
            style={{ bottom: `${(index + 1) * 55}px` }}
          >
            <i className={`${action.icon} text-sm bg-gradient-to-r ${action.color} bg-clip-text text-transparent`} />
            <span className="text-xs font-medium text-gray-700">{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>
      
      <motion.button
        animate={{ rotate: isOpen ? 45 : 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-2xl shadow-blue-500/30 flex items-center justify-center group"
      >
        <motion.i 
          className="ri-add-line text-white text-2xl"
          animate={{ rotate: isOpen ? 45 : 0 }}
        />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 blur-xl transition-opacity -z-10" />
      </motion.button>
    </div>
  );
};

// ============ MAIN DASHBOARD COMPONENT ============
export default function DashboardPage({ useLayout = true }) {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Admin');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeSection, setActiveSection] = useState('kpi');
  const [apiProjectData, setApiProjectData] = useState([]);
  const [apiSubtaskData, setApiSubtaskData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { handleMinimize, handleMaximize, isMaximized, windowSize } = useMacOSWindow();
  const sectionRefs = useRef({});

  const sections = [
    { key: 'kpi', label: 'Analytics', icon: 'ri-dashboard-line' },
    { key: 'rag', label: 'Health Monitor', icon: 'ri-pie-chart-2-line' },
    { key: 'health', label: 'Projects', icon: 'ri-folder-3-line' },
    { key: 'subtasks', label: 'Tasks', icon: 'ri-task-line' },
    { key: 'delay', label: 'Timeline', icon: 'ri-timer-2-line' },
  ];

  const dockItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' },
    { key: 'analytics', label: 'Analytics', icon: 'ri-bar-chart-2-line' },
    { key: 'projects', label: 'Projects', icon: 'ri-folder-line' },
    { key: 'tasks', label: 'Tasks', icon: 'ri-checkbox-line' },
    { key: 'reports', label: 'Reports', icon: 'ri-file-chart-line' },
  ];

  const handleRowClick = (project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedProject(null), 350);
  };

  const scrollToSection = (key) => {
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Data fetching
  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || 'Admin');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const fetchJson = async (path, fullUrl) => kfGetJson(kfInstance, path, fullUrl);
        const accountId = resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID)
        const fieldsPath = `/case/2/${accountId}/${CASE_ID}/fields`
        // Prefer /list (honors page_size). View list/items returns ~21/page only.
        const listPath = `/case/2/${accountId}/${CASE_ID}/list?page_number=1&page_size=${KF_ADMIN_PAGE_SIZE}`
        
        const fieldsResponse = await fetchJson(fieldsPath, `${BASE_URL}${fieldsPath}`);
        const fieldIds = new Set((Array.isArray(fieldsResponse) ? fieldsResponse : []).map((f) => f?.Id).filter(Boolean));
        const listResponse = await fetchJson(listPath, `${BASE_URL}${listPath}`);
        let listItems = Array.isArray(listResponse?.Data) ? listResponse.Data : [];
        // Paginate /list if more than one page
        let pageNumber = 2;
        while (listItems.length >= KF_ADMIN_PAGE_SIZE * (pageNumber - 1) && pageNumber <= 50) {
          const nextPath = `/case/2/${accountId}/${CASE_ID}/list?page_number=${pageNumber}&page_size=${KF_ADMIN_PAGE_SIZE}`;
          const nextRes = await fetchJson(nextPath, `${BASE_URL}${nextPath}`);
          const batch = Array.isArray(nextRes?.Data) ? nextRes.Data : [];
          if (!batch.length) break;
          listItems = listItems.concat(batch);
          if (batch.length < KF_ADMIN_PAGE_SIZE) break;
          pageNumber += 1;
        }
        const detailById = {};
        const activityById = {};
        const rows = mapItemsToProjectRows(listItems, detailById, activityById, fieldIds);
        const taskRows = await fetchAllAdminProcessItems(kfInstance, 'Project_Sub_Task_A01', {
          applyPreference: false,
          accountId,
        });
        const subtasks = taskRows.length
          ? mapProcessSubtasksToRows(taskRows)
          : rows.flatMap((r) => r.subtasks || []);
        
        if (!cancelled) {
          setApiProjectData(rows);
          setApiSubtaskData(subtasks);
        }
      } catch (error) {
        if (!cancelled) console.warn('Fetch failed:', error);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [kfInstance]);

  const totalProjects = apiProjectData.length;
  const activeProjects = apiProjectData.filter((p) => p.status !== 'Completed').length;
  const completedProjects = apiProjectData.filter((p) => p.status === 'Completed').length;
  const delayedProjects = apiProjectData.filter((p) => p.delayDays > 0 && p.status !== 'Completed').length;
  const totalSubtasks = apiSubtaskData.length;
  const openTasks = apiSubtaskData.filter((t) => t.status !== 'Completed').length;
  const completedTasks = apiSubtaskData.filter((t) => t.status === 'Completed').length;
  const overdueTasks = apiSubtaskData.filter((t) => t.status === 'Overdue').length;

  const content = (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 ${isMaximized ? 'p-0' : 'p-6'}`}>
      <GlassHeader 
        userName={userName} 
        roleName={roleName}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        isMaximized={isMaximized}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Spring Animation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent">
            Welcome back, {userName}
          </h2>
          <p className="text-gray-500 mt-2">Here's your real-time project intelligence dashboard</p>
        </motion.div>

        {/* KPI Section with Animated Cards */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <AnimatedKPICard 
              title="Total Projects" value={totalProjects} icon="ri-folder-line"
              trend="+12%" color="from-blue-500 to-blue-600" delay={0.1}
            />
            <AnimatedKPICard 
              title="Active Projects" value={activeProjects} icon="ri-play-circle-line"
              trend={`${Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)}%`} 
              color="from-emerald-500 to-emerald-600" delay={0.15}
            />
            <AnimatedKPICard 
              title="Completed" value={completedProjects} icon="ri-checkbox-circle-line"
              trend="+8%" color="from-purple-500 to-purple-600" delay={0.2}
            />
            <AnimatedKPICard 
              title="At Risk" value={delayedProjects} icon="ri-alert-line"
              trend={`${Math.round((delayedProjects / Math.max(totalProjects, 1)) * 100)}%`}
              color="from-rose-500 to-rose-600" delay={0.25}
            />
        </div>
      </div>

        {/* Section Tabs */}
        <div className="mb-8">
          <AnimatedSectionTabs 
            sections={sections}
            activeSection={activeSection}
            onSectionChange={scrollToSection}
          />
        </div>

        {/* Animated Sections with Scroll References */}
        <div className="space-y-8">
          <motion.section 
            ref={(el) => { sectionRefs.current.kpi = el; }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <PremiumCard className="p-6">
              <KPISection metrics={{
                totalProjects, activeProjects, completedProjects, delayedProjects,
                totalSubtasks, openTasks, completedTasks, overdueTasks,
                trendTotalProjects: '+0%',
                trendActiveProjects: `${Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)}% of total`,
                trendCompletedProjects: `${Math.round((completedProjects / Math.max(totalProjects, 1)) * 100)}% completion rate`,
                trendDelayedProjects: `${Math.round((delayedProjects / Math.max(totalProjects, 1)) * 100)}% at risk`,
              }} />
            </PremiumCard>
          </motion.section>

          <motion.section 
            ref={(el) => { sectionRefs.current.rag = el; }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 300 }}
          >
            <PremiumCard className="p-6">
              <RAGSummaryBar data={apiProjectData} />
            </PremiumCard>
          </motion.section>

          <motion.section 
            ref={(el) => { sectionRefs.current.health = el; }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
          >
            <PremiumCard className="overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800">Project Portfolio</h3>
                <p className="text-sm text-gray-500 mt-1">Click any row for detailed insights</p>
              </div>
              <ProjectHealthTable data={apiProjectData} onRowClick={handleRowClick} />
            </PremiumCard>
          </motion.section>

          <motion.section 
            ref={(el) => { sectionRefs.current.subtasks = el; }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
          >
            <PremiumCard className="overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Task Management</h3>
                    <p className="text-sm text-gray-500 mt-1">Track all project subtasks</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-50">
                    <span className="text-sm font-medium text-blue-600">{totalSubtasks} Total Tasks</span>
                  </div>
                </div>
      </div>
              <SubtaskTable data={apiSubtaskData} />
            </PremiumCard>
          </motion.section>

          <motion.section 
            ref={(el) => { sectionRefs.current.delay = el; }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          >
            <PremiumCard className="p-6">
              <DelayRevisionSection data={apiProjectData} />
            </PremiumCard>
          </motion.section>
        </div>
      </div>

      {/* Premium Dock */}
      <PremiumDock items={dockItems} activeItem="dashboard" onItemClick={scrollToSection} />

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => window.print()} />

      {/* Bouncy Modal */}
      <BouncyMacOSModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title="Project Intelligence"
      >
        {selectedProject && (
          <ProjectDrillDownModal 
            project={selectedProject} 
            onClose={handleCloseModal}
            isEmbedded={true}
          />
        )}
      </BouncyMacOSModal>
    </div>
  );

  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

// ============ HELPER FUNCTIONS ============
function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

function parseKfDate(dateLike) {
  if (!dateLike) return null;
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_\/]+$/, '');
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('complete')) return 'Completed';
  if (s.includes('plan') || s.includes('new') || s.includes('notstart')) return 'Planning';
  if (s.includes('hold')) return 'On Hold';
  return 'Active';
}

function mapRag(value, delayDays) {
  const s = String(value || '').toLowerCase();
  if (s.includes('red')) return 'Red';
  if (s.includes('amber') || s.includes('yellow')) return 'Amber';
  if (s.includes('green')) return 'Green';
  return delayDays > 0 ? 'Red' : 'Green';
}

function mapSubtaskStatus(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

function mapSubtaskTrackerStatus(taskStatus, systemStatus, endDate) {
  const raw = String(taskStatus || systemStatus || '').trim().toLowerCase();
  const completed = raw.includes('complete') || raw.includes('closed') || raw.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (!raw) return 'Pending';
  if (raw.includes('review') || raw.includes('inprogress') || raw.includes('progress') || raw.includes('started')) return 'In Progress';
  if (raw.includes('open') || raw.includes('pending') || raw.includes('todo')) return 'Pending';
  return 'Pending';
}

function mapProcessSubtasksToRows(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows.map((row, idx) => {
    const projectName =
      row?.Project_Lookup?.Project_Name ||
      row?.Project_ID?.Project_Name ||
      row?.Datelookup?.Project_Name ||
      row?.Project_ID_Details ||
      '—';
    const assignedTo = row?.Assigned_To?.Name || 'Unassigned';
    const endRaw = row?.End_Date || row?.fetch_End_date || row?.Datelookup?.End_Date;
    const startRaw = row?.Start_Date || row?.fetch_start_date || row?.Datelookup?.Start_Date;
    return {
      id: row?.Subtaxk_id || row?._id || `SUBTASK-${idx + 1}`,
      projectName,
      taskName: row?.Sub_Task_Name || row?.Name || 'Untitled Task',
      assignedTo,
      assigneeAvatar: toInitials(assignedTo),
      status: mapSubtaskTrackerStatus(row?.Task_Status, row?._status, endRaw),
      startDate: fmtDate(parseKfDate(startRaw)),
      endDate: fmtDate(parseKfDate(endRaw)),
      agingDays: Number(row?.Aging_Days ?? 0),
      delayDays: Number(row?.Delay_Days ?? 0),
      _raw: row,
    };
  });
}

function pickDisplayRef(detail, item, subtasks, fallbackId) {
  const candidates = [
    detail?.Task_ID,
    detail?.Task_Id,
    detail?.TaskID,
    detail?.Project_Task_ID,
    detail?.Project_ID,
    detail?.Project_Id,
    detail?.ProjectID,
    detail?.Project_Code,
    detail?.Code,
    item?.Task_ID,
    item?.TaskId,
    item?.Project_ID,
    item?.ProjectId,
    item?.Project_Code,
    item?.Code,
    subtasks?.[0]?.Subtask_ID,
    subtasks?.[0]?._id,
  ];
  const normalized = candidates.map((v) => String(v ?? '').trim()).find(Boolean);
  return normalized || String(fallbackId ?? '');
}

function mapItemsToProjectRows(items, detailById, activityById, availableFieldIds) {
  const now = new Date();
  const hasField = (id) => !availableFieldIds || availableFieldIds.has(id);
  return items.map((item, index) => {
    const id = item?._item_id || item?._id || `PRJ-${index + 1}`;
    const detail = detailById[id] || {};
    const ownerName = detail?.Business_Owner?.Name || item?.AssignedTo?.Name || item?.Requester?.Name || item?._created_by?.Name || 'Unassigned';
    const status = mapStatus(detail?._status_name || item?._status_name || detail?._category || item?._category || '');
    const dueDate = parseKfDate(detail?.End_Date || detail?.DueDate || item?.DueDate);
    const startDate = parseKfDate(detail?.Start_Date || detail?._start_date || item?._start_date || item?._created_at);
    const delayDays = status !== 'Completed' && dueDate && dueDate < now ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const timeline = Array.isArray(detail?.['Table::Project_Timeline_History']) ? detail['Table::Project_Timeline_History'] : [];
    const activities = Array.isArray(activityById[id]) ? activityById[id] : [];
    const subtasks = Array.isArray(detail?.['Table::Project_Subtasks']) ? detail['Table::Project_Subtasks'] : [];
    const completedTasks = subtasks.filter((s) => mapSubtaskStatus(s?.Task_Status_1, s?.End_date_2) === 'Completed').length;
    const totalTasks = subtasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (status === 'Completed' ? 100 : status === 'Planning' ? 20 : 55);
    const rag = mapRag(detail?.RAG_Calculation, delayDays);
    const displayId = pickDisplayRef(detail, item, subtasks, id);
    return {
      id, displayId, name: hasField('Project_Name') ? (detail?.Project_Name || item?.Name || `Project ${id}`) : (item?.Name || `Project ${id}`),
      owner: ownerName, ownerAvatar: toInitials(ownerName),
      lineOfBusiness: hasField('Project_Category') ? (detail?.Project_Category || 'Project Management') : 'Project Management',
      priority: detail?._priority_name || item?._priority_name || detail?.Priority_1 || 'Low',
      startDate: fmtDate(startDate), originalEndDate: fmtDate(dueDate), revisedEndDate: null, revisedCount: timeline.length,
      progress, rag, status, delayDays, totalTasks, completedTasks,
      risk: hasField('Risk') ? (detail?.Risk || 'N/A') : 'N/A',
      governanceFrequency: hasField('Governance_Frequency') ? (detail?.Governance_Frequency || 'N/A') : 'N/A',
      entity: hasField('Entity') ? (detail?.Entity || 'N/A') : 'N/A',
      aiUsage: hasField('AI_Usage') ? Boolean(detail?.AI_Usage) : false,
      subtasks: subtasks.map((row, subIdx) => {
        const end = fmtDate(parseKfDate(row?.End_date_2));
        const st = mapSubtaskStatus(row?.Task_Status_1, row?.End_date_2);
        const due = parseKfDate(row?.End_date_2);
        const delay = st !== 'Completed' && due && due < now ? Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          id: row?.Subtask_ID || row?._id || `${id}-SUB-${subIdx + 1}`,
          projectId: id, projectName: detail?.Project_Name || item?.Name || `Project ${id}`,
          taskName: row?.Subtask_Name || 'Untitled Task',
          assignedTo: row?.Assigned_To_1?.Name || 'Unassigned',
          assigneeAvatar: toInitials(row?.Assigned_To_1?.Name || 'Unassigned'),
          status: st, startDate: fmtDate(parseKfDate(row?.Start_Date_2)), endDate: end,
          agingDays: Number(row?.Aging_Days || 0), delayDays: delay,
        };
      }),
      revisionHistory: timeline.map((rev, revIdx) => ({
        date: fmtDate(parseKfDate(rev?.Changed_on || rev?._created_at)),
        previousEndDate: 'N/A', newEndDate: fmtDate(parseKfDate(rev?.New_Revised_Date || rev?.Changed_on)),
        reason: 'Timeline updated', revisedBy: rev?._created_by?.Name || 'System',
        key: rev?._id || `${id}-REV-${revIdx + 1}`,
      })),
      activityHistory: activities.map((event, actIdx) => {
        const change = event?._change_summary || {};
        const changeKeys = Object.keys(change);
        const firstKey = changeKeys[0];
        const firstChange = firstKey ? change[firstKey] : null;
        return {
          key: event?._id || `${id}-ACT-${actIdx + 1}`,
          date: fmtDate(parseKfDate(event?._created_at)),
          eventType: event?._event_type || 'Updated',
          field: event?._event_field || firstKey || 'Project',
          by: event?._created_by?.Name || 'System',
          oldValue: firstChange?.old_value?.Name || firstChange?.old_value || null,
          newValue: firstChange?.current_value?.Name || firstChange?.current_value || null,
          status: event?._status_name || null,
        };
      }),
    };
  });
}