import { useEffect, useLayoutEffect, useState, useRef, Component, lazy, Suspense, type ReactNode, type ErrorInfo, type MouseEvent } from 'react';
import { useQuery } from 'convex/react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import { ArrowRight, Bell, BookOpen, ChevronRight, ClipboardList, FlaskConical, HeartHandshake, Home, Lightbulb, LogOut, Menu, MessagesSquare, Search, ShieldCheck, Sparkles, Sprout, Users, X, WifiOff } from 'lucide-react';
import { AppContext, isOperator, type Route } from './context';
import { Badge, Button, Input, Loading, Modal, Notice, errorText, labels } from './ui';
import { HomePage, SearchPage, LibraryPage, InnovationPage } from './Knowledge';
const CasesPage = lazy(() => import('./Work').then(module => ({ default:module.CasesPage })));
const CardPage = lazy(() => import('./Work').then(module => ({ default:module.CardPage })));
const IdeasPage = lazy(() => import('./Work').then(module => ({ default:module.IdeasPage })));
const IdeaPage = lazy(() => import('./Work').then(module => ({ default:module.IdeaPage })));
const CallsPage = lazy(() => import('./Work').then(module => ({ default:module.CallsPage })));
const ApplicationPage = lazy(() => import('./Work').then(module => ({ default:module.ApplicationPage })));
const PilotsPage = lazy(() => import('./Community').then(module => ({ default:module.PilotsPage })));
const PilotPage = lazy(() => import('./Community').then(module => ({ default:module.PilotPage })));
const PartnersPage = lazy(() => import('./Community').then(module => ({ default:module.PartnersPage })));
const MessagesPage = lazy(() => import('./Community').then(module => ({ default:module.MessagesPage })));
const NotificationsPage = lazy(() => import('./Community').then(module => ({ default:module.NotificationsPage })));
const AdminPage = lazy(() => import('./Admin').then(module => ({ default:module.AdminPage })));
const SettingsPage = lazy(() => import('./Settings').then(module => ({ default:module.SettingsPage })));

const endpoint: any = api;
const navigation = [
  { page: 'home', label: 'Początek', icon: Home }, { page: 'search', label: 'Znajdź rozwiązanie', icon: Search },
  { page: 'library', label: 'Biblioteka wiedzy', icon: BookOpen }, { page: 'cases', label: 'Moje sprawy', icon: ClipboardList },
  { page: 'ideas', label: 'Pomysły i Canwa', icon: Lightbulb }, { page: 'calls', label: 'Nabory grantowe', icon: Sprout },
  { page: 'pilots', label: 'Testuj innowacje', icon: FlaskConical }, { page: 'partners', label: 'Współpraca i zasoby', icon: HeartHandshake },
  { page: 'messages', label: 'Rozmowy', icon: MessagesSquare },
];
function readRoute(): Route { const [page, id] = window.location.hash.replace(/^#\/?/, '').split('/'); return { page: page || 'home', id }; }
class Boundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) { return { error: errorText(error) }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Error is presented without leaking request context. */ }
  render() { return this.state.error ? <div className="panel"><h1>Nie udało się otworzyć widoku</h1><Notice error>{this.state.error}</Notice><Button onClick={() => { window.location.hash = '/home'; window.location.reload(); }}>Wróć do początku</Button></div> : this.props.children; }
}
export default function App() {
  const user = useQuery(endpoint.hub.me);
  const notifications = useQuery(endpoint.hub.notifications, user ? {} : 'skip');
  const { signIn, signOut } = useAuthActions();
  const [route, setRoute] = useState(readRoute);
  const [mobile, setMobile] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const mainRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseTarget = useRef<'trigger' | 'main' | 'login'>('trigger');
  const previousRoute = useRef(`${route.page}/${route.id || ''}`);
  const focusMain = () => { mainRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); };
  useLayoutEffect(() => {
    const key = `${route.page}/${route.id || ''}`;
    if (previousRoute.current !== key) { previousRoute.current = key; focusMain(); }
  }, [route.page, route.id]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    let frame = 0;
    const update = () => {
      const inNavigation = document.activeElement?.closest('.sidebar');
      const onToggle = document.activeElement === menuTriggerRef.current;
      setMobileViewport(media.matches);
      if (!media.matches) { mobileCloseTarget.current = 'main'; setMobile(false); }
      if (inNavigation || onToggle) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => media.matches ? menuTriggerRef.current?.focus({ preventScroll: true }) : focusMain());
      }
    };
    media.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); cancelAnimationFrame(frame); };
  }, []);
  const [login, setLogin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', signup: false });
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [sessionExpired, setSessionExpired] = useState(false);
  const previousAuthenticated = useRef(false), intentionalLogout = useRef(false);
  useEffect(() => { if (user === undefined) return; if (previousAuthenticated.current && !user && !intentionalLogout.current) setSessionExpired(true); if (user) setSessionExpired(false); previousAuthenticated.current = !!user; if (!user) intentionalLogout.current = false; }, [user]);
  useEffect(() => { const update = () => { mobileCloseTarget.current = 'main'; setRoute(readRoute()); setMobile(false); }; window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { const update = () => setOffline(!navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(null), 7000); return () => window.clearTimeout(timer); } }, [notice]);
  const closeNavigationForContent = () => { mobileCloseTarget.current = 'main'; setMobile(false); };
  const handleNavSelection = (event: MouseEvent<HTMLElement>) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && mobile) closeNavigationForContent();
  };
  const navigate = (page: string, id?: string) => { if (mobile) closeNavigationForContent(); window.location.hash = `/${page}${id ? `/${id}` : ''}`; };
  const openLogin = () => {
    if (mobile) { mobileCloseTarget.current = 'login'; setMobile(false); }
    else setLogin(true);
  };
  const toast = (message: string, error = false) => setNotice({ message, error });
  const requireAuth = () => { if (user) return true; openLogin(); return false; };
  const unread = (notifications || []).filter((n: any) => !n.readAt && !n.read).length;
  async function authenticate(email = authData.email, password = authData.password, signup = authData.signup) {
    setAuthBusy(true); setAuthError('');
    try { await signIn('password', { email, password, flow: signup ? 'signUp' : 'signIn', ...(signup ? { name: authData.name } : {}) }); setLogin(false); toast('Jesteś zalogowany. Możesz wrócić do swojej sprawy.'); }
    catch (error) { setAuthError(errorText(error)); } finally { setAuthBusy(false); }
  }
  const activePage = route.page === 'innovation' ? 'library' : route.page === 'idea' ? 'ideas' : route.page === 'card' ? 'cases' : route.page === 'pilot' ? 'pilots' : route.page === 'application' ? 'calls' : route.page;
  const page = (() => { switch (route.page) {
    case 'search': return <SearchPage />; case 'library': return <LibraryPage />; case 'innovation': return <InnovationPage id={route.id!} />;
    case 'cases': return <CasesPage />; case 'card': return <CardPage id={route.id!} />;
    case 'ideas': return <IdeasPage />; case 'idea': return <IdeaPage id={route.id} />; case 'calls': return <CallsPage />; case 'application': return <ApplicationPage id={route.id!} />;
    case 'pilots': return <PilotsPage />; case 'pilot': return <PilotPage id={route.id!} />; case 'partners': return <PartnersPage />;
    case 'settings': return <SettingsPage />; case 'messages': return <MessagesPage id={route.id} />; case 'notifications': return <NotificationsPage />; case 'admin': return <AdminPage />; default: return <HomePage />;
  } })();
  const sidebarContent = <><a className="brand" href="#/home" onClick={handleNavSelection} aria-label="Splot. Strona główna"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>splot<span className="brand-sub">dla HubMI</span></span></a><div className="sidebar-caption">POTRZEBY · POMYSŁY · WDROŻENIA</div><nav aria-label="Nawigacja główna">{navigation.map(({ page, label, icon: Icon }) => <a key={page} href={`#/${page}`} onClick={handleNavSelection} aria-current={activePage === page ? 'page' : undefined} className={activePage === page ? 'active' : ''}><Icon size={19} /><span>{label}</span>{activePage === page && <span className="nav-dot" />}</a>)}{isOperator(user) && <a href="#/admin" onClick={handleNavSelection} aria-current={activePage === 'admin' ? 'page' : undefined} className={activePage === 'admin' ? 'active' : ''}><ShieldCheck size={19} /><span>Panel ROPS</span></a>}</nav><div className="sidebar-bottom"><div className="help-card"><span className="tiny-icon"><HeartHandshake size={19} /></span><strong>Skonsultuj swój plan</strong><p>Zapytaj ROPS o rozwiązanie, warunki wdrożenia lub partnerów.</p><button onClick={() => user ? navigate('messages') : openLogin()}>Porozmawiaj z ROPS <ArrowRight size={15} /></button></div><div className="region-mark"><span className="region-symbol">m</span><span>Małopolski Hub<br /><strong>Innowacji Społecznych</strong></span></div></div></>;
  return <AppContext.Provider value={{ user, navigate, toast, requireAuth }}><Dialog.Root open={mobileViewport && mobile} onOpenChange={open => { mobileCloseTarget.current = 'trigger'; setMobile(open); }}><a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); focusMain(); }}>Przejdź do treści</a><div className="app-shell">

    {!mobileViewport && <aside id="desktop-navigation" className="sidebar desktop-navigation">{sidebarContent}</aside>}

    <div className="workspace"><header className="topbar"><div className="topbar-left"><Dialog.Trigger asChild><button ref={menuTriggerRef} className="icon-button mobile-menu" aria-label="Otwórz nawigację" aria-controls="mobile-navigation" aria-expanded={mobileViewport && mobile}><Menu /></button></Dialog.Trigger><span className="breadcrumb">Splot dla HubMI <ChevronRight size={14} /><strong>{navigation.find(n => n.page === activePage)?.label || (route.page === 'admin' ? 'Panel ROPS' : route.page === 'settings' ? 'Ustawienia konta' : 'Powiadomienia')}</strong></span></div><div className="topbar-actions"><Badge tone="demo"><span className="status-dot" /><span className="demo-label-full">Wersja demonstracyjna</span><span className="demo-label-short">Demo</span></Badge>{user ? <><button className="icon-button notification-button" aria-label={`Powiadomienia, nieprzeczytane: ${unread}`} onClick={() => navigate('notifications')}><Bell size={20} />{unread > 0 && <span className="notification-count">{unread}</span>}</button><button className="user-chip" aria-label="Ustawienia konta i prywatność" onClick={() => navigate('settings')}><span className="avatar">{(user.name || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}</span><span><strong>{user.name}</strong><small>{user.organization || labels[user.role] || 'Użytkownik'}</small></span></button><button className="icon-button" aria-label="Wyloguj" onClick={async () => { intentionalLogout.current = true; await signOut(); localStorage.removeItem('splot:search'); navigate('home'); toast('Wylogowano. Zapisane sprawy czekają na Twoim koncie.'); }}><LogOut size={18} /></button></> : <Button small onClick={openLogin}>Zaloguj się <ArrowRight size={16} /></Button>}</div></header>
    {offline && <div className="offline-banner" role="status"><WifiOff size={18} /> Brak połączenia. Szkice na tym urządzeniu są zachowane; zapis na koncie wymaga połączenia.</div>}
    <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}><Boundary key={`${user?.userId || 'guest'}/${route.page}/${route.id || ''}`}><>{sessionExpired && <Notice error>Sesja wygasła. Zaloguj się ponownie, aby zapisać zmiany. Zapisane dokumenty pozostały na koncie, a lokalny szkic czeka na powrót tego samego użytkownika. <Button secondary onClick={openLogin}>Przywróć sesję</Button></Notice>}<Suspense fallback={<Loading />}>{page}</Suspense></></Boundary></main><footer className="footer"><span>Splot dla HubMI</span><span>DEFOZO SOFTWARE HOUSE</span></footer></div></div>
    {mobileViewport && <Dialog.Portal><Dialog.Overlay className="sidebar-scrim" /><Dialog.Content asChild onCloseAutoFocus={event => {
      event.preventDefault();
      const destination = mobileCloseTarget.current;
      mobileCloseTarget.current = 'trigger';
      if (destination === 'main' || !window.matchMedia('(max-width: 760px)').matches) focusMain();
      else {
        menuTriggerRef.current?.focus({ preventScroll: true });
        if (destination === 'login') setLogin(true);
      }
    }}><aside id="mobile-navigation" className="sidebar open mobile-navigation"><Dialog.Title className="sr-only">Nawigacja</Dialog.Title><Dialog.Description className="sr-only">Wybierz widok. Escape zamyka nawigację i przywraca fokus do przycisku menu.</Dialog.Description><Dialog.Close className="icon-button mobile-navigation-close" aria-label="Zamknij nawigację"><X size={22} /></Dialog.Close>{sidebarContent}</aside></Dialog.Content></Dialog.Portal>}
    </Dialog.Root>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`toast ${notice.error ? 'toast-error' : ''}`}><span>{notice.message}</span><button className="icon-button" aria-label="Zamknij komunikat" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <Modal open={login} onClose={() => setLogin(false)} title={authData.signup ? 'Dołącz do Splotu' : 'Wróć do swoich spraw'} description="Biblioteka i wyszukiwanie są dostępne bez konta. Zaloguj się, aby zapisać potrzebę i współpracować.">
      {authError && <Notice error>{authError}</Notice>}<form onSubmit={e => { e.preventDefault(); void authenticate(); }} className="stack">{authData.signup && <Input label="Imię i nazwisko" value={authData.name} onChange={name => setAuthData({ ...authData, name })} required />}<Input label="Adres e-mail" type="email" value={authData.email} onChange={email => setAuthData({ ...authData, email })} required /><Input label="Hasło" type="password" value={authData.password} onChange={password => setAuthData({ ...authData, password })} required /><Button loading={authBusy} type="submit">{authData.signup ? 'Utwórz konto mieszkańca' : 'Zaloguj się'} <ArrowRight size={17} /></Button><button type="button" className="text-button" onClick={() => setAuthData({ ...authData, signup: !authData.signup })}>{authData.signup ? 'Mam już konto' : 'Nie mam jeszcze konta'}</button></form>
      <div className="demo-login"><span className="eyebrow">POZNAJ CZTERY PERSPEKTYWY</span><p>Wybierz rolę i przejdź przez jej zadania.</p><div className="demo-grid">{[{ email: 'mieszkaniec@splot.demo', label: 'Mieszkanka', Icon: Users }, { email: 'instytucja@splot.demo', label: 'Instytucja / CUS', Icon: Home }, { email: 'ekspert@splot.demo', label: 'Ekspertka', Icon: Sparkles }, { email: 'rops@splot.demo', label: 'Zespół ROPS', Icon: ShieldCheck }].map(({ email, label, Icon }) => <Button key={email} secondary small disabled={authBusy} onClick={() => void authenticate(email, 'SplotDemo2026!', false)}><Icon size={17} />{label}</Button>)}</div></div>
    </Modal></AppContext.Provider>;
}
