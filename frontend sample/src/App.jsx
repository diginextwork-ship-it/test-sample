import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import AboutUs from "./pages/AboutUs";
import Contact from "./pages/contact";
import Gallery from "./pages/Gallery";
import JobSearch from "./pages/JobSearch";
import JobApplication from "./pages/JobApplication";
import RecruiterLogin from "./pages/RecruiterLogin";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import AdminCreateRecruiter from "./pages/admin/AdminCreateRecruiter";
import AdminRidPerformance from "./pages/admin/AdminRidPerformance";
import AdminTopResumes from "./pages/admin/AdminTopResumes";
import AdminResumeUploads from "./pages/admin/AdminResumeUploads";
import AdminManualSelection from "./pages/admin/AdminManualSelection";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminAttendance from "./pages/admin/AdminAttendance";
import ErrorPage from "./pages/ErrorPage";
import ScheduleCall from "./pages/ScheduleCall";
import { clearAuthSession, getAuthSession } from "./auth/session";

const PAGE_TO_PATH = {
  home: "/",
  jobs: "/jobs",
  applyjob: "/jobs/apply",
  contactus: "/contactus",
  aboutus: "/about-us",
  gallery: "/gallery",
  schedulecall: "/schedule-call",
  recruiterlogin: "/recruiter-login",
  adminlogin: "/admin-login",
  adminpanel: "/admin-panel",
  admincreate: "/admin-panel/create-recruiter",
  adminridstats: "/admin-panel/recruiter-performance",
  admintopresumes: "/admin-panel/top-resumes",
  adminuploads: "/admin-panel/recruiter-uploads",
  adminmanualselection: "/admin-panel/manual-selection",
  adminrevenue: "/admin-panel/revenue",
  adminattendance: "/admin-panel/attendance",
};

const ADMIN_ONLY_PAGES = new Set([
  "adminpanel",
  "admincreate",
  "adminridstats",
  "admintopresumes",
  "adminuploads",
  "adminmanualselection",
  "adminrevenue",
  "adminattendance",
]);

const normalizePath = (pathname) => {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const getPageFromPath = (pathname) => {
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === "/") return "home";
  if (normalizedPath === "/jobs") return "jobs";
  if (normalizedPath === "/jobs/apply") return "applyjob";
  if (normalizedPath === "/contactus") return "contactus";
  if (normalizedPath === "/about-us") return "aboutus";
  if (normalizedPath === "/gallery") return "gallery";
  if (normalizedPath === "/schedule-call") return "schedulecall";
  if (normalizedPath === "/recruiter-login") return "recruiterlogin";
  if (normalizedPath === "/admin-login") return "adminlogin";
  if (normalizedPath === "/admin-panel") return "adminpanel";
  if (normalizedPath === "/admin-panel/create-recruiter") return "admincreate";
  if (normalizedPath === "/admin-panel/recruiter-performance") return "adminridstats";
  if (normalizedPath === "/admin-panel/top-resumes") return "admintopresumes";
  if (normalizedPath === "/admin-panel/recruiter-uploads") return "adminuploads";
  if (normalizedPath === "/admin-panel/manual-selection") return "adminmanualselection";
  if (normalizedPath === "/admin-panel/revenue") return "adminrevenue";
  if (normalizedPath === "/admin-panel/attendance") return "adminattendance";
  return "notfound";
};

export default function App() {
  const [authSession, setAuthSession] = useState(() => getAuthSession());
  const [currentPage, setCurrentPageState] = useState(() => getPageFromPath(window.location.pathname));
  const isAdmin = useMemo(
    () => String(authSession?.role || "").trim().toLowerCase() === "admin",
    [authSession?.role]
  );
  const guardedPage =
    ADMIN_ONLY_PAGES.has(currentPage) && !isAdmin ? "adminlogin" : currentPage;

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPageState(getPageFromPath(window.location.pathname));
      setAuthSession(getAuthSession());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!ADMIN_ONLY_PAGES.has(currentPage) || isAdmin) return;
    const loginPath = PAGE_TO_PATH.adminlogin;
    if (normalizePath(window.location.pathname) !== loginPath) {
      window.history.replaceState({ page: "adminlogin" }, "", loginPath);
    }
  }, [currentPage, isAdmin]);

  const setCurrentPage = (page) => {
    if (ADMIN_ONLY_PAGES.has(page) && !isAdmin) {
      page = "adminlogin";
    }

    const nextPath = PAGE_TO_PATH[page] || "/";
    const activePath = normalizePath(window.location.pathname);
    setCurrentPageState(page);

    if (activePath !== nextPath) {
      window.history.pushState({ page }, "", nextPath);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthSession(null);
    setCurrentPage("home");
  };

  const renderPage = () => {
    switch (guardedPage) {
      case "contactus":
        return <Contact setCurrentPage={setCurrentPage} />;
      case "aboutus":
        return <AboutUs setCurrentPage={setCurrentPage} />;
      case "gallery":
        return <Gallery setCurrentPage={setCurrentPage} />;
      case "jobs":
        return <JobSearch setCurrentPage={setCurrentPage} />;
      case "applyjob":
        return <JobApplication setCurrentPage={setCurrentPage} />;
      case "schedulecall":
        return <ScheduleCall setCurrentPage={setCurrentPage} />;
      case "recruiterlogin":
        return <RecruiterLogin />;
      case "adminlogin":
        return (
          <AdminLogin
            onLoginSuccess={() => {
              setAuthSession(getAuthSession());
              setCurrentPage("adminpanel");
            }}
          />
        );
      case "adminpanel":
        return <AdminPanel setCurrentPage={setCurrentPage} onLogout={handleLogout} />;
      case "admincreate":
        return <AdminCreateRecruiter setCurrentPage={setCurrentPage} />;
      case "adminridstats":
        return <AdminRidPerformance setCurrentPage={setCurrentPage} />;
      case "admintopresumes":
        return <AdminTopResumes setCurrentPage={setCurrentPage} />;
      case "adminuploads":
        return <AdminResumeUploads setCurrentPage={setCurrentPage} />;
      case "adminmanualselection":
        return <AdminManualSelection setCurrentPage={setCurrentPage} />;
      case "adminrevenue":
        return <AdminRevenue setCurrentPage={setCurrentPage} />;
      case "adminattendance":
        return <AdminAttendance setCurrentPage={setCurrentPage} />;
      case "notfound":
        return (
          <ErrorPage
            code={404}
            title="Page not found"
            message="The page you requested does not exist or has been moved."
            onRetry={() => setCurrentPage("home")}
          />
        );
      default:
        return <Home setCurrentPage={setCurrentPage} />;
    }
  };

  if (guardedPage === "notfound") {
    return renderPage();
  }

  return (
    <div className="app">
      {currentPage === "home" ? (
        <Navbar setCurrentPage={setCurrentPage} currentPage={currentPage} />
      ) : null}
      {renderPage()}
      <Footer setCurrentPage={setCurrentPage} minimal={currentPage !== "home"} isAdmin={isAdmin} />
    </div>
  );
}
