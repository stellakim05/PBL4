import React, { useState, useMemo, useEffect, useRef } from "react";
import "./App.css";
import { api } from "./api/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const Shell = ({ children, currentUser, onLogout, onOpenSettings }) => (
  <div className="shell" style={{ position: "relative" }}>
    {currentUser && (
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
        {onOpenSettings && (
          <button
            className="btn btn--ghost"
            onClick={onOpenSettings}
            style={{ 
              fontSize: 14,
              border: "1.5px solid #666",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              marginRight: 8
            }}
          >
            Settings
          </button>
        )}
        <button 
          className="btn btn--ghost" 
          onClick={onLogout}
          style={{ 
            fontSize: 14,
            border: "1.5px solid #666",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
          }}
        >
          Log Out
        </button>
      </div>
    )}
    <div className="container">{children}</div>
  </div>
);

const Card = React.forwardRef(({ children }, ref) => (
  <div className="card" ref={ref}>{children}</div>
));

const Field = ({ label, help, children }) => (
  <div className="field">
    <label className="field__label">{label}</label>
    {children}
    {help && <div className="muted" style={{ fontSize: 12 }}>{help}</div>}
  </div>
);

const Select = React.forwardRef(function Select(props, ref) {
  return <select ref={ref} className="select" {...props} />;
});
const Textarea = React.forwardRef(function Textarea(props, ref) {
  return <textarea ref={ref} className="textarea" rows={3} {...props} />;
});

function KV({ k, v }) {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{v}</div>
    </div>
  );
}

function CourseModal({ course, onClose }) {
  if (!course) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{course.name}</h2>
        <p className="muted" style={{ marginTop: 6 }}>Details</p>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <KV k="Course Name" v={course.courseName || course.name} />
          <KV k="Day" v={course.day} />
          <KV k="Period" v={String(course.period)} />
          <KV k="Professor" v={course.professor} />
          <KV k="Modality" v={course.modality} />
          <KV k="Final" v={course.hasFinal ? "Yes" : "No"} />
          <KV k="Category" v={course.category === "liberal-arts" ? "Liberal Arts" : "Specialized"} />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const modalityToServer = {
  "face-to-face": "face-to-face",
  "online": "on-demand",
  "hybrid": "hybrid",
  "none": "none",
};
const normalizeForAPI = (prefs) => ({
  ...prefs,
  modality: modalityToServer[prefs.modality] ?? prefs.modality,
});

const encodeShare = (payload) =>
  encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
const decodeShare = (hashStr) => {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(hashStr))));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const SAVED_KEY = "savedSchedules";
const getSavedSchedules = () => {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const setSavedSchedules = (arr) => {
  localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
};

export default function App() {
  const [stage, setStage] = useState("gate");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [loginForm, setLoginForm] = useState({ userId: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    userId: "",
    password: "",
    confirm: "",
    university: "",
    email: "",
    department: "",
    grade: "",
    term: "",
  });

  const [settingsForm, setSettingsForm] = useState({
    userId: "",
    password: "",
    confirm: "",
    university: "",
    email: "",
    department: "",
    grade: "",
    term: "",
  });
  const [settingsUserId, setSettingsUserId] = useState("");
  const [settingsUserLoaded, setSettingsUserLoaded] = useState(false);

  async function doLogin({ userId, password }) {
    if (!userId || !password) throw new Error("Missing credentials");
    const resp = await api.login({ user_id: userId, password });
    return resp;
  }

  async function doSignup(payload) {
    const { userId, password, confirm, university, email, department, grade, term } = payload;
    if (!userId || !password || !confirm || !university || !email || !department || !grade || !term) {
      throw new Error("Missing fields");
    }
    if (password.length < 8) throw new Error("Password must be at least 8 characters long");
    if (password !== confirm) throw new Error("Passwords do not match");
    const resp = await api.signup({
      user_id: userId,
      password,
      email,
      university,
      department,
      grade,
      term_id: term ? parseInt(term) : null,
    });
    return resp;
  }


  const NO = "none";
  const MAX_CLASSES = 12;

  const UNIVERSITIES = [
  "Ritsumeikan University"
];

  const initial = {
    time: NO,
    finals: NO,
    dayOff: NO,
    modality: NO,
    liberalArts: NO,
    preferredProfessors: "",
    dislikedProfessors: "",
  };

  const mergePrefs = (maybe) => ({ ...initial, ...(typeof maybe === "object" && maybe ? maybe : {}) });

  const [values, setValues] = useState(() => {
    const saved = localStorage.getItem("preferences");
    const parsed = saved ? JSON.parse(saved) : null;
    return mergePrefs(parsed);
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState(null);
  const [activeTerm, setActiveTerm] = useState(null);
  const [termsLoading, setTermsLoading] = useState(true);

  const selectedCount = useMemo(() => {
    let c = 0;
    if ((values.time ?? NO) !== NO) c++;
    if ((values.finals ?? NO) !== NO) c++;
    if ((values.dayOff ?? NO) !== NO) c++;
    if ((values.modality ?? NO) !== NO) c++;
    if ((values.liberalArts ?? NO) !== NO) c++;
    return c;
  }, [values.time, values.finals, values.dayOff, values.modality, values.liberalArts]);

  useEffect(() => {
    const loadTerms = async () => {
      setTermsLoading(true);
      try {
        let termsList = await api.getTerms();
        console.log("Loaded terms:", termsList);
        
        if (termsList.length === 0) {
          console.log("No terms found, initializing...");
          try {
            const initResult = await api.initTerms();
            console.log("Init result:", initResult);
            termsList = await api.getTerms(); 
            console.log("Reloaded terms:", termsList);
          } catch (initErr) {
            console.error("Failed to init terms:", initErr);
          }
        }
        
        const active = await api.getActiveTerm();
        console.log("Active term:", active);
        
        setTerms(termsList);
        if (active) {
          setActiveTerm(active);
          setSelectedTermId(active.id);
        } else if (termsList.length > 0) {
          setSelectedTermId(termsList[0].id);
        }
      } catch (err) {
        console.error("Failed to load terms:", err);
      } finally {
        setTermsLoading(false);
      }
    };
    loadTerms();
  }, []);

  const trySet = (key, next) => {
    const isText = key === "dislikedProfessors" || key === "preferredProfessors";
    if (isText) {
      setValues((v) => ({ ...v, [key]: next ?? "" }));
      return;
    }
    
    const nextVal = next ?? NO;
    setValues((v) => ({ ...v, [key]: nextVal }));
  };

  const Days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const Periods = [1, 2, 3, 4, 5, 6, 7];
  
  const periodLabels = {
    1: "1st period: 9:00 a.m.～10:35 a.m.",
    2: "2nd period: 10:45 a.m.～12:20 p.m.",
    3: "3rd period: 1:10 p.m.～2:45 p.m.",
    4: "4th period: 2:55 p.m.～4:30 p.m.",
    5: "5th period: 4:40 p.m.～6:15 p.m.",
    6: "6th period: 6:25 p.m.～8:00 p.m.",
    7: "7th period: 8:10 p.m.～9:45 p.m."
  };

  const [schedule, setSchedule] = useState(null);
  const [dayOff, setDayOff] = useState(null);
  const [fromSavedSchedules, setFromSavedSchedules] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showUseSavedSubmenu, setShowUseSavedSubmenu] = useState(false);
  const saveMenuRef = useRef(null);
  const scheduleCardRef = useRef(null);

  const handlePrefSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalized = normalizeForAPI(values);
      await api.savePreferences(normalized);
      localStorage.setItem("preferences", JSON.stringify(mergePrefs(values)));
      const result = await api.generateSchedule(normalized, selectedTermId);
      setSchedule(result.schedule);
      setDayOff(result.day_off);
      setSaved(true);
      setFromSavedSchedules(false);
      setStage("schedule");
    } catch (err) {
      console.error(err);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      const result = await api.generateSchedule(normalizeForAPI(values), selectedTermId);
      setSchedule(result.schedule);
      setDayOff(result.day_off);
    } finally {
      setLoading(false);
    }
  };

  const resetPrefs = () => {
    setValues({ ...initial });
    localStorage.removeItem("preferences");
    setSaved(false);
    setSchedule(null);
    setDayOff(null);
  };

  const [openCourse, setOpenCourse] = useState(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpenCourse(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buildExportPayload = () => ({
    meta: {
      generatedAt: new Date().toISOString(),
      total: schedule ? Object.values(schedule).filter(Boolean).length : 0,
      max: MAX_CLASSES,
      dayOff: dayOff || null,
    },
    preferences: values,
    schedule,
  });

  const download = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    download("schedule.json", JSON.stringify(buildExportPayload(), null, 2), "application/json");
  };

  const exportCSV = () => {
    if (!schedule) return;
    const header = ["TIME", ...Days];
    const rows = [header];
    for (const p of Periods) {
      const row = [periodLabels[p]];
      for (const d of Days) {
        const key = `${d}-${p}`;
        const course = schedule[key];
        const isDayOff = dayOff && d === dayOff;
        const cell = course ? (course.name || "") : (isDayOff ? "Day Off" : "-");
        row.push(cell);
      }
      rows.push(row);
    }
    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download("schedule.csv", csv, "text/csv;charset=utf-8");
  };

  const generateCleanScheduleHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Schedule</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              background: #fff;
              color: #000;
              font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
              padding: 20px;
            }
            .schedule-container {
              max-width: 1000px;
              margin: 0 auto;
            }
            .tt-grid {
              display: grid;
              grid-template-columns: 90px repeat(5, 1fr);
              gap: 8px;
              margin-top: 20px;
            }
            .tt-head {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #6b7280;
              padding: 8px 4px;
              text-align: center;
              font-weight: 700;
            }
            .tt-period {
              font-weight: 800;
              font-size: 12px;
              color: #333;
              display: flex;
              align-items: center;
              padding: 8px 6px;
              border: 1px dashed #ddd;
              border-radius: 10px;
              background: #f7f7f7;
              text-align: left;
            }
            .tt-cell {
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              min-height: 60px;
              padding: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              background: #fff;
              color: #000;
              font-weight: normal;
            }
            .tt-cell.day-off {
              background: #f0f8ff;
              border: 2px solid #4a90e2;
              color: #2c5aa0;
              font-weight: bold;
            }
            .tt-cell.empty {
              opacity: 0.6;
            }
          </style>
        </head>
        <body>
          <div class="schedule-container">
            <div class="tt-grid">
              <div class="tt-head">Time</div>
              ${["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => `<div class="tt-head">${d}</div>`).join('')}
              ${Periods.map(p => `
                <div class="tt-period">${periodLabels[p]}</div>
                ${["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => {
                  const key = `${d}-${p}`;
                  const course = schedule[key];
                  const isDayOff = dayOff && d === dayOff;
                  const isEmpty = !course && !isDayOff;
                  let cellClass = 'tt-cell';
                  if (isDayOff) cellClass += ' day-off';
                  if (isEmpty) cellClass += ' empty';
                  const content = course ? course.name : isDayOff ? '🏖️ Day Off' : '-';
                  return `<div class="${cellClass}">${content}</div>`;
                }).join('')}
              `).join('')}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const exportAsFormat = async (format) => {
    if (!schedule) return;
    setShowExportMenu(false);
    
    if (format === "CSV") {
      exportCSV();
      return;
    }
    
    try {
      const html = generateCleanScheduleHTML();
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '1200px';
      iframe.style.height = '800px';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const bodyElement = iframeDoc.body;
      
      const canvas = await html2canvas(bodyElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: bodyElement.scrollWidth,
        height: bodyElement.scrollHeight,
      });
      
      document.body.removeChild(iframe);

      if (format === "PDF") {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const imgWidth = 297; 
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save('schedule.pdf');
      } else {
        const mimeType = format === "JPG" ? "image/jpeg" : "image/png";
        const extension = format === "JPG" ? "jpg" : "png";
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `schedule.${extension}`;
          a.click();
          URL.revokeObjectURL(url);
        }, mimeType, 1.0);
      }
    } catch (err) {
      console.error('Failed to export:', err);
      alert(`Failed to export schedule as ${format}. Error: ${err.message || err.toString()}. Please check the browser console for more details.`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target)) {
        setShowSaveMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    if (showSaveMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu, showSaveMenu]);

  const printPage = async () => {
    if (!schedule) return;
    
    // Instead of using window.print() which blocks, export as PDF and open print dialog
    try {
      const html = generateCleanScheduleHTML();
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '1200px';
      iframe.style.height = '800px';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const bodyElement = iframeDoc.body;
      
      const canvas = await html2canvas(bodyElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: bodyElement.scrollWidth,
        height: bodyElement.scrollHeight,
      });
      
      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Save and trigger print preview
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open in new tab and print
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
          }, 100);
        };
      }
    } catch (err) {
      console.error('Failed to print:', err);
      alert(`Failed to print schedule. Error: ${err.message || err.toString()}.`);
    }
  };

  const shareLink = async () => {
    const payload = buildExportPayload();
    const hash = encodeShare(payload);
    const url = `${location.origin}${location.pathname}#share=${hash}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Schedule", text: "Here is my schedule.", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Share link copied to clipboard!");
      } else {
        prompt("Copy this link:", url);
      }
    } catch {}
  };

  useEffect(() => {
    const h = location.hash || "";
    const m = h.match(/#share=([^&]+)/);
    if (m && m[1]) {
      const data = decodeShare(m[1]);
      if (data && data.schedule) {
        setSchedule(data.schedule);
        setDayOff(data.meta?.dayOff || null);
        if (data.preferences) setValues(mergePrefs(data.preferences));
      setSaved(true);
        setStage("schedule");
      }
    }
  }, []);

  const [savedList, setSavedList] = useState([]);
  const [savedListLoading, setSavedListLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.id && (stage === "saved-schedules" || stage === "menu" || stage === "schedule")) {
      const loadSavedSchedules = async () => {
        setSavedListLoading(true);
        try {
          const schedules = await api.getSavedSchedules(currentUser.id);
          setSavedList(schedules);
        } catch (err) {
          console.error("Failed to load saved schedules:", err);
        } finally {
          setSavedListLoading(false);
        }
      };
      loadSavedSchedules();
    }
  }, [currentUser?.id, stage]);

  const saveNewSchedule = async () => {
    if (!schedule || !currentUser?.id) return;
    const name = prompt("Name this schedule:");
    if (!name) return;
    setLoading(true);
    try {
      await api.saveSchedule({
        name,
        preferences: values,
        schedule,
        day_off: dayOff,
      }, currentUser.id);
      alert("Saved!");
    
      const schedules = await api.getSavedSchedules(currentUser.id);
      setSavedList(schedules);
      setShowSaveMenu(false);
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert("Failed to save schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (!schedule || !currentUser?.id) return;
    if (Array.isArray(savedList) && savedList.length > 0) {
      
      setShowSaveMenu((v) => !v);
    } else {
      
      saveNewSchedule();
    }
  };

  const overwriteSavedSchedule = async (target) => {
    if (!schedule || !currentUser?.id || !target) return;
    setShowUseSavedSubmenu(false);
    setShowSaveMenu(false);
    setLoading(true);
    try {
      await api.deleteSavedSchedule(target.id, currentUser.id);
      await api.saveSchedule({
        name: target.name || "Untitled",
        preferences: values,
        schedule,
        day_off: dayOff,
      }, currentUser.id);
      alert(`Saved schedule \"${target.name}\" has been updated.`);
      const schedules = await api.getSavedSchedules(currentUser.id);
      setSavedList(schedules);

    } catch (err) {
      console.error("Failed to update saved schedule:", err);
      alert("Failed to update saved schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async (id) => {
    const item = savedList.find((x) => x.id === id);
    if (!item) return;
    setValues(mergePrefs(item.preferences));
    setSchedule(item.schedule || null);
    setDayOff(item.day_off || null);
    setSaved(true);
    setFromSavedSchedules(true);
    setStage("schedule");
  };

  const deleteSaved = async (id) => {
    if (!confirm("Delete this saved schedule?") || !currentUser?.id) return;
    setLoading(true);
    try {
      await api.deleteSavedSchedule(id, currentUser.id);
      const schedules = await api.getSavedSchedules(currentUser.id);
      setSavedList(schedules);
    } catch (err) {
      console.error("Failed to delete schedule:", err);
      alert("Failed to delete schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      setCurrentUser(null);
      setStage("gate");
    }
  };

  const handleOpenSettings = () => {
    if (currentUser?.user_id) {
      setSettingsUserId(currentUser.user_id);
      const loadUserInfo = async () => {
        setLoading(true);
        try {
          const user = await api.getUser(currentUser.user_id);
          setSettingsForm({
            userId: user.user_id || "",
            password: "",
            confirm: "",
            university: user.university || "",
            email: user.email || "",
            department: user.department || "",
            grade: user.grade || "",
            term: user.term_id ? String(user.term_id) : "",
          });
          setSettingsUserLoaded(true);
          setStage("settings");
        } catch (err) {
          const errorMessage = err.message || "Failed to load user info";
          alert(errorMessage);
        } finally {
          setLoading(false);
        }
      };
      loadUserInfo();
    } else {
      setStage("settings");
    }
  };

  if (stage === "gate") {
    return (
      <Shell>
        <Card style={{ maxWidth: "200px"}}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Welcome</h1>
          <p className="muted" style={{ marginTop: 6 }}>Choose an option to continue.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", alignItems: "center", justifyContent: "flex-start" }}>
            <button className="btn" onClick={() => { setAuthError(""); setStage("login"); }}>Log In</button>
            <button className="btn btn--ghost" onClick={() => { setAuthError(""); setStage("signup"); }}>
              Sign Up
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (stage === "login") {
    return (
      <Shell currentUser={null} onLogout={handleLogout}>
        <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Log In</h1>
          <p className="muted" style={{ marginTop: 6 }}>Enter your ID or Email and password.</p>

          <form
            className="form__row"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true); setAuthError("");
              try {
                const user = await doLogin({
                  userId: loginForm.userId ?? "",
                  password: loginForm.password ?? "",
                });
                setCurrentUser(user);
                
                if (user?.term_id) setSelectedTermId(user.term_id);
                setStage("menu");
              } catch (err) {
                const raw = (err && err.message) ? String(err.message) : "Invalid credentials";

                let popup = raw;
                if (raw.includes("Wrong user id")) {
                  popup = "Wrong user id";
                } else if (raw.includes("Wrong password")) {
                  popup = "Wrong password";
                }
                setAuthError("");
                alert(popup);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="User ID or Email">
              <input
                className="select"
                value={loginForm.userId ?? ""}
                onChange={(e) => setLoginForm({ ...loginForm, userId: e.currentTarget.value })}
                placeholder="your_id or email@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                className="select"
                type="password"
                value={loginForm.password ?? ""}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.currentTarget.value })}
                placeholder="••••••••"
              />
            </Field>

            {authError && <div className="alert--error">{authError}</div>}

          <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => setStage("gate")} disabled={loading}>
                Back
            </button>
            <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Log In"}
                </button>
          </div>
        </div>
          </form>
        </Card>
      </Shell>
    );
  }

  if (stage === "signup") {
    return (
      <Shell currentUser={null} onLogout={handleLogout}>
        <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Sign Up</h1>
          <p className="muted" style={{ marginTop: 6 }}>Create your account.</p>

          <form
            className="form__row"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true); setAuthError("");
              try {
                const user = await doSignup({
                  userId: signupForm.userId ?? "",
                  password: signupForm.password ?? "",
                  confirm: signupForm.confirm ?? "",
                  university: signupForm.university ?? "",
                  email: signupForm.email ?? "",
                  department: signupForm.department ?? "",
                  grade: signupForm.grade ?? "",
                  term: signupForm.term ?? "",
                });
                setCurrentUser(user);
                setSelectedTermId(user?.term_id ?? (signupForm.term ? parseInt(signupForm.term) : null));
                setStage("menu");
              } catch (err) {
                const errorMessage = err.message || "Failed to sign up.";
                console.error("Signup error:", errorMessage);
                setAuthError("");
                alert(errorMessage);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="User ID">
              <input
                className="select"
                value={signupForm.userId ?? ""}
                onChange={(e) => setSignupForm({ ...signupForm, userId: e.currentTarget.value })}
                placeholder="your_id"
              />
            </Field>

            <Field label="Email">
              <input
                className="select"
                type="email"
                value={signupForm.email ?? ""}
                onChange={(e) => setSignupForm({ ...signupForm, email: e.currentTarget.value })}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Password">
              <input
              className="select"
              type="password"
              value={signupForm.password ?? ""}
              onChange={(e) => setSignupForm({ ...signupForm, password: e.currentTarget.value })}
              placeholder="8+ characters"
              minLength={8}           
              required         
              autoComplete="new-password"
              />
              </Field>
              <Field label="Confirm Password">
                <input
                className="select"
                type="password"
                value={signupForm.confirm ?? ""}
                onChange={(e) => setSignupForm({ ...signupForm, confirm: e.currentTarget.value })}
                placeholder="retype password"
                minLength={8}
                required
                autoComplete="new-password"
                />
              </Field>

              <Field label="University">
                <Select
                  value={signupForm.university ?? ""}
                  onChange={(e) => setSignupForm({ ...signupForm, university: e.currentTarget.value })}
                  required
                >
                  <option value="">Select university</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </Field>


            <Field label="Department">
              <Select
                value={signupForm.department ?? ""}
                onChange={(e) => setSignupForm({ ...signupForm, department: e.currentTarget.value })}
              >
                <option value="">Select department</option>
                <option value="business">Business Department</option>
                <option value="economics">Economics</option>
                <option value="law">Law</option>
                <option value="science">Science & Engineering</option>
              </Select>
            </Field>

            <Field label="Grade">
              <Select
                value={signupForm.grade ?? ""}
                onChange={(e) => setSignupForm({ ...signupForm, grade: e.currentTarget.value })}
              >
                <option value="">Select grade</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="graduate">Graduate</option>
              </Select>
            </Field>

            <Field label="Semester">
              <Select 
                value={signupForm.term ?? ""} 
                onChange={(e) => setSignupForm({ ...signupForm, term: e.currentTarget.value })}
                disabled={termsLoading}
                required
              >
                <option value="">{termsLoading ? "Loading semesters..." : "Select semester"}</option>
                {terms
                  .filter((term) => term?.name === "2025 Spring" || term?.name === "2025 Fall")
                  .map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
              </Select>
            </Field>

            {authError && <div className="alert--error">{authError}</div>}

            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => setStage("gate")} disabled={loading}>
                Back
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Account"}
                </button>
    </div>
            </div>
          </form>
        </Card>
      </Shell>
    );
  }

  if (stage === "settings") {
    return (
      <Shell currentUser={currentUser} onLogout={handleLogout} onOpenSettings={handleOpenSettings}>
        <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Settings</h1>
          <p className="muted" style={{ marginTop: 6 }}>Update your account information.</p>

          {!settingsUserLoaded ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p className="muted">Loading user information...</p>
    </div>
          ) : (
            <form
              className="form__row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!currentUser?.user_id) {
                  alert("User ID is required");
                  return;
                }
                setLoading(true); setAuthError("");
                try {
                  const updateData = {};
                  if (settingsForm.userId && settingsForm.userId !== currentUser.user_id) {
                    updateData.user_id = settingsForm.userId;
                  }
                  if (settingsForm.email) updateData.email = settingsForm.email;
                  if (settingsForm.university) updateData.university = settingsForm.university;
                  if (settingsForm.department) updateData.department = settingsForm.department;
                  if (settingsForm.grade) updateData.grade = settingsForm.grade;
                  if (settingsForm.term) updateData.term_id = parseInt(settingsForm.term);
                  if (settingsForm.password) {
                    if (settingsForm.password !== settingsForm.confirm) {
                      throw new Error("Passwords do not match");
                    }
                    updateData.password = settingsForm.password;
                  }

                  const updateUserId = updateData.user_id || currentUser.user_id;
                  const user = await api.updateUser(currentUser.user_id, updateData);
                  setCurrentUser(user);
                  alert("Settings updated successfully!");
                  setStage("menu");
                } catch (err) {
                  const errorMessage = err.message || "Failed to update settings.";
                  console.error("Settings update error:", errorMessage);
                  setAuthError("");
                  alert(errorMessage);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Field label="User ID">
                <input
                  className="select"
                  value={settingsForm.userId ?? settingsUserId}
                  onChange={(e) => setSettingsForm({ ...settingsForm, userId: e.currentTarget.value })}
                  placeholder="your_id"
                />
              </Field>

              <Field label="Email">
                <input
                  className="select"
                  type="email"
                  value={settingsForm.email ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, email: e.currentTarget.value })}
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="Password (leave blank to keep current password)">
                <input
                  className="select"
                  type="password"
                  value={settingsForm.password ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, password: e.currentTarget.value })}
                  placeholder="8+ characters"
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm Password">
                <input
                  className="select"
                  type="password"
                  value={settingsForm.confirm ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, confirm: e.currentTarget.value })}
                  placeholder="retype password"
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="University">
                <Select
                  value={settingsForm.university ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, university: e.currentTarget.value })}
                >
                  <option value="">Select university</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Department">
                <Select
                  value={settingsForm.department ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, department: e.currentTarget.value })}
                >
                  <option value="">Select department</option>
                  <option value="business">Business Department</option>
                  <option value="economics">Economics</option>
                  <option value="law">Law</option>
                  <option value="science">Science & Engineering</option>
                </Select>
              </Field>

              <Field label="Grade">
                <Select
                  value={settingsForm.grade ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, grade: e.currentTarget.value })}
                >
                  <option value="">Select grade</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="graduate">Graduate</option>
                </Select>
              </Field>

              <Field label="Semester">
                <Select 
                  value={settingsForm.term ?? ""} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, term: e.currentTarget.value })}
                  disabled={termsLoading}
                >
                  <option value="">{termsLoading ? "Loading semesters..." : "Select semester"}</option>
                  {terms
                    .filter((term) => term?.name === "2025 Spring" || term?.name === "2025 Fall")
                    .map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                </Select>
              </Field>

              {authError && <div className="alert--error">{authError}</div>}

          <div className="btn-row">
                <button type="button" className="btn btn--ghost" onClick={() => setStage("menu")} disabled={loading}>
                  Back
            </button>
            <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "Updating..." : "Update Settings"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </Card>
      </Shell>
    );
  }

  if (stage === "menu") {
    return (
      <Shell currentUser={currentUser} onLogout={handleLogout} onOpenSettings={handleOpenSettings}>
        <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Welcome back, {currentUser?.user_id || "User"}!</h1>
          <p className="muted" style={{ marginTop: 6 }}>Choose an option to continue.</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
              <button
                className="btn"
              onClick={() => setStage("saved-schedules")}
              style={{ padding: "16px", fontSize: "16px" }}
            >
              View Saved Schedules
            </button>
            <button 
              className="btn btn--ghost" 
              onClick={() => {
                resetPrefs();
                setStage("prefs");
              }}
              style={{ padding: "16px", fontSize: "16px" }}
            >
              Select Preferences for New Schedule
              </button>
            </div>
        </Card>
      </Shell>
    );
  }

  if (stage === "saved-schedules") {
  return (
      <Shell currentUser={currentUser} onLogout={handleLogout} onOpenSettings={handleOpenSettings}>
      <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Saved Schedules</h1>
          <p className="muted" style={{ marginTop: 6 }}>View and manage your saved schedules.</p>

          {savedListLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p className="muted">Loading schedules...</p>
          </div>
          ) : savedList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p className="muted">No saved schedules yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
              {savedList.map((s) => (
                <div key={s.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" onClick={() => loadSaved(s.id)} disabled={loading}>Load</button>
                      <button className="btn btn--ghost" onClick={() => deleteSaved(s.id)} disabled={loading}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn--ghost" onClick={() => setStage("menu")} disabled={loading}>
              Back to Menu
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (stage === "prefs") {
  return (
      <Shell currentUser={currentUser} onLogout={handleLogout} onOpenSettings={handleOpenSettings}>
      <Card>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Select Preferences</h1>
        <p className="muted" style={{ marginTop: 6 }}>
            Choose your preferences by category.
          </p>

          <form onSubmit={handlePrefSubmit} className="form__row">
          <Field label="Class Time Preference:">
              <Select value={values.time ?? NO} onChange={(e) => trySet("time", e.currentTarget.value)}>
              <option value={NO}>No preference</option>
                <option value="morning">Prefer morning classes (9:00 AM - 12:20 PM)</option>
                <option value="afternoon">Prefer afternoon classes (1:10 PM - 6:15 PM)</option>
                <option value="late">Prefer late classes (6:25 PM - 9:45 PM)</option>
            </Select>
          </Field>

          <Field label="Final Exam Preference:">
              <Select value={values.finals ?? NO} onChange={(e) => trySet("finals", e.currentTarget.value)}>
              <option value={NO}>No preference</option>
              <option value="avoid-finals">Prefer no final exams</option>
              <option value="prefer-finals">Prefer final exams</option>
            </Select>
          </Field>

          <Field label="Day Off Preference:">
              <select 
                className="select"
                value={values.dayOff ?? NO} 
                onChange={(e) => {
                  const newValue = e.target.value;
                  trySet("dayOff", newValue);
                }}
              >
              <option value={NO}>No preference</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              </select>
          </Field>

          <Field label="Course Format Preference:">
              <Select value={values.modality ?? NO} onChange={(e) => trySet("modality", e.currentTarget.value)}>
              <option value={NO}>No preference</option>
                <option value="face-to-face">Prefer face-to-face classes</option>
                <option value="online">Prefer online classes</option>
              <option value="hybrid">Prefer hybrid format</option>
            </Select>
          </Field>

          <Field label="Course Type Preference:">
              <Select value={values.liberalArts ?? NO} onChange={(e) => trySet("liberalArts", e.currentTarget.value)}>
              <option value={NO}>No preference</option>
              <option value="prefer-la">Prefer liberal arts courses</option>
              <option value="prefer-specialized">Prefer specialized major courses</option>
            </Select>
          </Field>

          <Field label="Professor Preferences:">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: "block" }}>
                  Prefer these professors:
                </label>
                <Textarea
                    value={values.preferredProfessors ?? ""}
                    onChange={(e) => trySet("preferredProfessors", e.currentTarget.value)}
                  placeholder="e.g., Tanaka, Suzuki"
                />
              </div>
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: "block" }}>
                  Avoid these professors:
                </label>
                <Textarea
                    value={values.dislikedProfessors ?? ""}
                    onChange={(e) => trySet("dislikedProfessors", e.currentTarget.value)}
                    placeholder="e.g., Sato, Kobayashi"
                />
              </div>
            </div>
          </Field>

          <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => setStage("menu")} disabled={loading}>
                Back
              </button>
            <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn--ghost" onClick={resetPrefs} disabled={loading}>
                Reset
              </button>
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Generating..." : "Generate Schedule"}
              </button>
            </div>
          </div>
        </form>
      </Card>
    </Shell>
  );
  }

  if (stage === "schedule") {
    const totalClasses = schedule ? Object.values(schedule).filter(Boolean).length : 0;

    return (
      <Shell currentUser={currentUser} onLogout={handleLogout} onOpenSettings={handleOpenSettings}>
        <Card ref={scheduleCardRef}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Recommended Schedule</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {selectedCount === 0
              ? "Generated balanced schedule (no preferences selected). Total classes: "
              : "Generated from your preferences. Total classes: "}
            {totalClasses} / {MAX_CLASSES}
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div ref={exportMenuRef} style={{ position: "relative" }}>
              <button 
                className="btn" 
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                Export
              </button>
              {showExportMenu && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  zIndex: 1000,
                  minWidth: 120
                }}>
                  <button
                    className="btn btn--ghost"
                    onClick={() => exportAsFormat("PNG")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: 0,
                      borderBottom: "1px solid var(--panel-border)"
                    }}
                  >
                    PNG
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => exportAsFormat("JPG")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: 0,
                      borderBottom: "1px solid var(--panel-border)"
                    }}
                  >
                    JPG
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => exportAsFormat("PDF")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: 0,
                      borderBottom: "1px solid var(--panel-border)"
                    }}
                  >
                    PDF
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => exportAsFormat("CSV")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: 0
                    }}
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
            <button className="btn" onClick={printPage}>Print</button>
            <div ref={saveMenuRef} style={{ position: "relative" }}>
              <button className="btn" onClick={handleSaveClick}>Save</button>
              {showSaveMenu && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  zIndex: 1000,
                  minWidth: 180
                }}>
                  <div style={{ position: "relative" }}>
                    <button
                      className="btn btn--ghost"
                      onClick={() => setShowUseSavedSubmenu((v) => !v)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderRadius: 0, borderBottom: "1px solid var(--panel-border)" }}
                    >
                      Use saved schedule
                    </button>
                    {showUseSavedSubmenu && (
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: "100%",
                        marginLeft: 6,
                        backgroundColor: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        zIndex: 1001,
                        minWidth: 200,
                        maxHeight: 260,
                        overflowY: 'auto'
                      }}>
                        <div style={{ position: 'absolute', top: 10, left: -6, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '6px solid var(--panel)', filter: 'drop-shadow(0 0 0 var(--panel-border))' }} />
                        {(savedList || []).map((s) => (
                          <button
                            key={s.id}
                            className="btn btn--ghost"
                            onClick={() => overwriteSavedSchedule(s)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderRadius: 0, borderBottom: "1px solid var(--panel-border)" }}
                          >
                            {s.name}
                          </button>
                        ))}
                        {(!savedList || savedList.length === 0) && (
                          <div className="muted" style={{ padding: "8px 12px" }}>No saved schedules</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn--ghost"
                    onClick={() => { setShowSaveMenu(false); saveNewSchedule(); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderRadius: 0 }}
                  >
                    Save new schedule
                  </button>
                </div>
              )}
            </div>
            <button className="btn" onClick={regenerate} disabled={loading}>
              {loading ? "Generating..." : "Generate Again"}
            </button>
          </div>

          <div className="tt-grid">
            <div className="tt-head">Time</div>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div key={d} className="tt-head">{d}</div>
            ))}
            {Periods.map((p) => (
              <React.Fragment key={p}>
                <div className="tt-period">{periodLabels[p]}</div>
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => {
                  const key = `${d}-${p}`;
                  const course = schedule?.[key];
                  const clickable = Boolean(course);
                  const isDayOff = dayOff && d === dayOff;
                  return (
                    <button
                      key={key}
                      className="tt-cell"
                      onClick={() => clickable && setOpenCourse(course)}
                      disabled={!clickable}
                      style={{
                        background: isDayOff ? "#f0f8ff" : "var(--panel)",
                        border: isDayOff ? "2px solid #4a90e2" : "1px solid var(--panel-border)",
                        borderRadius: "var(--radius)",
                        padding: 10,
                        minHeight: 60,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        color: isDayOff ? "#2c5aa0" : "var(--ink)",
                        opacity: clickable ? 0.95 : 0.6,
                        cursor: clickable ? "pointer" : "default",
                        fontWeight: isDayOff ? "bold" : "normal",
                      }}
                      aria-label={
                        clickable ? `Open details for ${course.name}` :
                        isDayOff ? "Day Off" : "Empty slot"
                      }
                      title={clickable ? "Click to view details" : isDayOff ? "Day Off" : ""}
                    >
                      {course ? course.name : isDayOff ? "Day Off" : <span className="muted">-</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {savedList.length > 0 && (
              <button className="btn btn--ghost" onClick={() => setStage("saved-schedules")} disabled={loading}>
                Back to Saved Schedules
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => setStage("prefs")} disabled={loading}>
              Change Preferences
            </button>
          </div>

          <CourseModal course={openCourse} onClose={() => setOpenCourse(null)} />
      </Card>
    </Shell>
  );
  }

  return null;
}