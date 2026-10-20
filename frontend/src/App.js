
import './App.css';
import Home from './pages/Home';
import Login from './pages/Login';
import PartnerAuth from './pages/PartnerAuth';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams
} from 'react-router-dom'
import PrivateRoute from './privateroutes/PrivateRoutes'
import UserState from './context/User/UserState';

import Tours from './pages/Tours';

import About from './pages/About';
import Gallery from './components/UI/Gallery';

import BusList from './components/UI/BusList';

import TourPlaces from './pages/TourPlaces';
import BusState from './context/bus/BusState';
import PassengerDetails from './components/UI/PassengerDetails';
import Credits from './pages/Credits';
import Profile from "./pages/Profile";
import { PartnerProvider } from './components/Partner/PartnerUI';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerBuses from './pages/partner/PartnerBuses';
import PartnerBusForm from './pages/partner/PartnerBusForm';
import PartnerBookings from './pages/partner/PartnerBookings';
import PartnerTours from './pages/partner/PartnerTours';
import PartnerTourForm from './pages/partner/PartnerTourForm';
import PartnerTourPlaces from './pages/partner/PartnerTourPlaces';
import PartnerProfile from './pages/partner/PartnerProfile';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPartners from './pages/admin/AdminPartners';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import BackToTop from './components/UI/BackToTop';
import ChatAssistant from './components/UI/ChatAssistant';
// Partner portal pages need a partner login and share toasts / confirm dialogs.
const partner = (page) => <PrivateRoute role="agent"><PartnerProvider>{page}</PartnerProvider></PrivateRoute>;
// Admin console pages need an admin login; bus/tour screens are shared with the partner portal.
const admin = (page) => <PrivateRoute role="admin"><PartnerProvider kind="admin">{page}</PartnerProvider></PrivateRoute>;
const OldAdminPlace = () => <Navigate to={`/admindb/opentour/${useParams().id}?add=1`} replace />;
const OldBookTour = () => <Navigate to={`/tourplaces/${useParams().id}`} replace />;

// Old links: /getUserDetails/:busId and /agent/addplace/:id.
const OldBusBookings = () => <Navigate to={`/agent/buses/${useParams().busId}/bookings`} replace />;
const OldAddPlace = () => <Navigate to={`/agent/opentour/${useParams().id}?add=1`} replace />;

function App() {
  return (
    <div className="App">
      <BusState>
      <UserState>
      <Router>
        <Routes>
          <Route exact path='/' element={ <Home/>}/>
          <Route exact path='/login' element={ <Login/>}/>
          <Route exact path='/tours' element={<Tours/>}/>
          <Route exact path='/Gallery' element={<Gallery/>}/>
          <Route exact  path='/buses' element={<BusList/>}/>
          <Route exact  path='/passengers' element={<PassengerDetails/>}/>

              <Route exact path="/about" element={<About />} />
              <Route exact path = "/tourplaces/:id" element={<TourPlaces />} />
              <Route exact path="/contact" element={<Navigate to="/about#contact" replace />} />
              <Route exact path="/credits" element={<Credits />} />
              <Route exact path="/profile" element={<PrivateRoute role={"user"}><Profile /></PrivateRoute>} />
              <Route exact path="/agentSignUp" element={<PartnerAuth mode="signup" />} />
              <Route exact path="/agentLogin" element={<PartnerAuth mode="login" />} />
             <Route exact path="/waitForApproval" element={<Navigate to="/agentLogin" replace />} />
              <Route exact path="/profile/editUserProfile" element={<Navigate to="/profile?tab=account" replace />} />


          {/* Admin console */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admindb/adminhome" replace />} />
          <Route path="/admindb" element={<Navigate to="/admindb/adminhome" replace />} />
          <Route path="/admindb/adminhome" element={admin(<AdminDashboard />)} />
          <Route path="/admindb/allusers" element={admin(<AdminUsers />)} />
          <Route path="/admindb/adduser" element={<Navigate to="/admindb/allusers" replace />} />
          <Route path="/admindb/allagents" element={admin(<AdminPartners />)} />
          <Route path="/admindb/allbuses" element={admin(<PartnerBuses />)} />
          <Route path="/admindb/editbus/:id" element={admin(<PartnerBusForm />)} />
          <Route path="/admindb/buses/:id/bookings" element={admin(<PartnerBookings kind="bus" />)} />
          <Route path="/admindb/alltours" element={admin(<PartnerTours />)} />
          <Route path="/admindb/edittour/:id" element={admin(<PartnerTourForm />)} />
          <Route path="/admindb/opentour/:id" element={admin(<PartnerTourPlaces />)} />
          <Route path="/admindb/tours/:id/bookings" element={admin(<PartnerBookings kind="tour" />)} />
          <Route path="/admindb/addplace/:id" element={<OldAdminPlace />} />
          <Route path="/admindb/booktour/:id" element={<OldBookTour />} />
          <Route path="/admindb/announcements" element={admin(<AdminAnnouncements />)} />

          {/* Partner portal */}
          <Route path="/agent/agentHome" element={partner(<PartnerDashboard />)} />
          <Route path="/agent/allbuses" element={partner(<PartnerBuses />)} />
          <Route path="/agent/addbus" element={partner(<PartnerBusForm />)} />
          <Route path="/agent/editbus/:id" element={partner(<PartnerBusForm />)} />
          <Route path="/agent/buses/:id/bookings" element={partner(<PartnerBookings kind="bus" />)} />
          <Route path="/agent/alltours" element={partner(<PartnerTours />)} />
          <Route path="/agent/addtour" element={partner(<PartnerTourForm />)} />
          <Route path="/agent/edittour/:id" element={partner(<PartnerTourForm />)} />
          <Route path="/agent/opentour/:id" element={partner(<PartnerTourPlaces />)} />
          <Route path="/agent/tours/:id/bookings" element={partner(<PartnerBookings kind="tour" />)} />
          <Route path="/agent/agentProfile" element={partner(<PartnerProfile />)} />
          <Route path="/agent/editAgentProfile" element={<Navigate to="/agent/agentProfile" replace />} />
          <Route path="/agent/addplace/:id" element={<OldAddPlace />} />
          <Route path="/getUserDetails/:busId" element={<OldBusBookings />} />
          <Route path="/agent" element={<Navigate to="/agent/agentHome" replace />} />
          <Route path="*" element={<h1>Page Not Found</h1>} />
        </Routes>
        <ChatAssistant />
        <BackToTop />
    </Router>
    </UserState>
    </BusState>
    </div>
  );
}

export default App;