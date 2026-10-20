import { useContext, useState } from 'react'
import '../components/CSS/Auth.css'
import Navbar from '../components/UI/Navbar'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import userContext from '../context/User/userContext'
import tourPhotos from '../constants/tourPhotos.json'
import { Field, StrengthMeter, Ticker } from '../components/UI/AuthParts'

const DEMO = { email: 'user@example.com', password: 'password123' }

// Only allow in-app paths for ?next= so the login page can't be used to redirect elsewhere.
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
const EMPTY_SIGNUP = { fname: '', lname: '', email: '', mobile: '', password: '', cpassword: '' }

// Departures match the seeded bus routes and timings.
const DEPARTURES = [
	{ title: 'Hyderabad → Bangalore', detail: 'Tonight, 9:00 PM · Volvo AC Seater' },
	{ title: 'Mumbai → Goa', detail: 'Tonight, 10:45 PM · AC Seater / Sleeper' },
	{ title: 'Bangalore → Chennai', detail: 'Today, 1:30 PM · Non-AC Seater' },
	{ title: 'Delhi → Jaipur', detail: 'Tomorrow, 6:00 AM · AC Sleeper' },
]

const RECENT_BOOKINGS = [
	{ title: 'Anil just booked', detail: 'Hyderabad → Bangalore · 2 min ago' },
	{ title: 'Yaswanth just booked', detail: 'Jaipur Pink City Royal Tour · 5 min ago' },
	{ title: 'Harihar just booked', detail: 'Vijayawada → Visakhapatnam · 9 min ago' },
	{ title: 'Stephen just booked', detail: 'Goa Beach Holiday · 14 min ago' },
]

const Login = () => {
	const navigate = useNavigate()
	const [params, setParams] = useSearchParams()
	const mode = params.get('mode') === 'signup' ? 'signup' : 'login'
	const { verifyUser, createUser } = useContext(userContext)
	const [loginCreds, setloginCreds] = useState({ email: '', password: '' })
	const [SignupCreds, setSignupCreds] = useState(EMPTY_SIGNUP)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [shakeKey, setShakeKey] = useState(0)

	const switchMode = (m) => {
		setError('')
		const next = params.get('next')
		setParams({ ...(m === 'signup' ? { mode: 'signup' } : {}), ...(next ? { next } : {}) }, { replace: true })
	}

	const fail = (message) => {
		setError(message)
		setShakeKey((k) => k + 1)
	}

	const onLoginInput = (e) => setloginCreds({ ...loginCreds, [e.target.name]: e.target.value })
	const onSignupInput = (e) => setSignupCreds({ ...SignupCreds, [e.target.name]: e.target.value })

	const HandleLogin = async (e) => {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const response = await verifyUser(loginCreds.email, loginCreds.password)
			if (response.success) {
				localStorage.token = response.authToken
				navigate(safeNext(params.get('next')))
			} else {
				fail(response.error || 'Invalid email or password')
			}
		} catch {
			fail('Could not reach the server. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	const HandleSignup = async (e) => {
		e.preventDefault()
		const { fname, lname, email, password, cpassword, mobile } = SignupCreds
		if (password !== cpassword) {
			fail('Passwords do not match')
			return
		}
		setError('')
		setLoading(true)
		try {
			const response = await createUser(fname, lname, email, mobile, password)
			if (response.success) {
				localStorage.token = response.authToken
				navigate(safeNext(params.get('next')))
			} else {
				fail(response.error || 'Could not create your account')
			}
		} catch {
			fail('Could not reach the server. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	const mismatch = SignupCreds.cpassword && SignupCreds.cpassword !== SignupCreds.password

	return (
		<>
			<Navbar />
			<div className="auth-page">
				<aside className="auth-visual" style={{ backgroundImage: `url('${tourPhotos.palolem.src}')` }}>
					<div className="auth-visual-overlay" />
					<div className="auth-visual-content">
						<span className="auth-chip"><i className="fa fa-location-arrow" /> Explore India your way</span>
						<h2>{mode === 'login' ? 'Welcome back, traveller' : 'Your next trip starts here'}</h2>
						<p>Book buses on 46 routes and curated tours across 16 cities, with secure payments and instant confirmation.</p>
					</div>
					<div className="auth-float auth-float--1"><i className="fa fa-route" /><Ticker items={DEPARTURES} /></div>
					<div className="auth-float auth-float--2"><i className="fa fa-bell" /><Ticker items={RECENT_BOOKINGS} offset={1600} /></div>
					<div className="auth-float auth-float--3"><i className="fa fa-wallet" /><div><strong>Pay your way</strong><span>UPI · Cards · Net banking</span></div></div>
				</aside>

				<main className="auth-panel">
					<div className="auth-card">
						<div className="auth-tabs" role="tablist">
							<span className="auth-tabs-indicator" style={{ transform: mode === 'signup' ? 'translateX(100%)' : 'none' }} />
							<button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Login</button>
							<button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
						</div>

						<div className="auth-head">
							<h1>{mode === 'login' ? 'Log in to Vihari' : 'Create your account'}</h1>
							<p>{mode === 'login' ? 'Pick up where you left off.' : 'It takes less than a minute.'}</p>
						</div>

						{error && <div className="auth-error" role="alert" key={shakeKey}><i className="fa fa-exclamation-circle" /> {error}</div>}

						{mode === 'login' ? (
							<form className="auth-form" onSubmit={HandleLogin} key="login">
								<Field icon="fa fa-envelope" type="email" name="email" aria-label="Email" value={loginCreds.email} onChange={onLoginInput} required autoComplete="email" />
								<Field icon="fa fa-lock" type="password" toggle name="password" aria-label="Password" value={loginCreds.password} onChange={onLoginInput} required autoComplete="current-password" />
								<button className="auth-submit" disabled={loading}>
									{loading ? <span className="auth-spinner" /> : <>Log in <i className="fa fa-arrow-right" /></>}
								</button>
								<button type="button" className="auth-demo" onClick={() => setloginCreds(DEMO)}>
									<i className="fa fa-magic" /> Use demo account
								</button>
							</form>
						) : (
							<form className="auth-form" onSubmit={HandleSignup} key="signup">
								<div className="auth-row">
									<Field icon="fa fa-user" name="fname" aria-label="First name" value={SignupCreds.fname} onChange={onSignupInput} required autoComplete="given-name" />
									<Field icon="fa fa-user" name="lname" aria-label="Last name" value={SignupCreds.lname} onChange={onSignupInput} required autoComplete="family-name" />
								</div>
								<Field icon="fa fa-envelope" type="email" name="email" aria-label="Email" value={SignupCreds.email} onChange={onSignupInput} required autoComplete="email" />
								<Field icon="fa fa-phone-alt" type="tel" name="mobile" aria-label="Mobile number" value={SignupCreds.mobile} onChange={onSignupInput} required pattern="[0-9]{10}" title="10-digit mobile number" autoComplete="tel" />
								<Field icon="fa fa-lock" type="password" toggle name="password" aria-label="Password" value={SignupCreds.password} onChange={onSignupInput} required minLength={6} autoComplete="new-password" />
								<StrengthMeter password={SignupCreds.password} />
								<Field icon="fa fa-lock" type="password" toggle name="cpassword" aria-label="Confirm password" value={SignupCreds.cpassword} onChange={onSignupInput} required autoComplete="new-password" />
								{mismatch && <small className="auth-hint auth-hint--bad"><i className="fa fa-times-circle" /> Passwords do not match</small>}
								<button className="auth-submit" disabled={loading}>
									{loading ? <span className="auth-spinner" /> : <>Create account <i className="fa fa-arrow-right" /></>}
								</button>
							</form>
						)}

						<p className="auth-switch">
							{mode === 'login' ? "New to Vihari? " : 'Already have an account? '}
							<button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
								{mode === 'login' ? 'Create an account' : 'Log in'}
							</button>
						</p>
						<Link to="/agentLogin" className="auth-agent">
							<i className="fa fa-briefcase" /> Bus operator or travel agent? <strong>Partner login</strong>
						</Link>
					</div>
				</main>
			</div>
		</>
	)
}

export default Login
