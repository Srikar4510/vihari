import { useContext, useRef, useState } from 'react'
import '../components/CSS/Auth.css'
import Navbar from '../components/UI/Navbar'
import { Link, useNavigate } from 'react-router-dom'
import userContext from '../context/User/userContext'
import { useCreateAgentMutation } from '../Slices/agentApiSlice'
import tourPhotos from '../constants/tourPhotos.json'
import approvalImage from '../Assets/approval.svg'
import { Field, StrengthMeter, Ticker } from '../components/UI/AuthParts'

const DEMO = { email: 'agent@example.com', password: 'password123' }
const EMPTY_APPLY = { agentName: '', email: '', password: '', cpassword: '', document: null }
const MAX_DOC_MB = 10

const PARTNER_UPDATES = [
	{ title: 'New booking', detail: 'SkyLine Travels · Hyderabad → Bangalore' },
	{ title: 'New booking', detail: 'Practice Travels · Goa Beach Holiday' },
	{ title: 'Seat filled', detail: 'Royal Cruiser · Mumbai → Pune, 9:00 PM' },
	{ title: 'Payout sent', detail: '₹18,450 to Night Rider' },
]

// Partner (bus operator / travel agent) login and application. `mode` is 'login' or 'signup'.
const PartnerAuth = ({ mode }) => {
	const navigate = useNavigate()
	const { verifyAgent } = useContext(userContext)
	const [createAgent] = useCreateAgentMutation()
	const [loginCreds, setLoginCreds] = useState({ email: '', password: '' })
	const [apply, setApply] = useState(EMPTY_APPLY)
	const [error, setError] = useState('')
	const [shakeKey, setShakeKey] = useState(0)
	const [loading, setLoading] = useState(false)
	const [status, setStatus] = useState(null) // 'pending' | 'submitted'
	const [dragging, setDragging] = useState(false)
	const fileInput = useRef(null)

	const fail = (message) => {
		setError(message)
		setShakeKey((k) => k + 1)
	}

	const go = (path) => {
		setError('')
		setStatus(null)
		navigate(path)
	}

	const handleLogin = async (e) => {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const response = await verifyAgent(loginCreds.email, loginCreds.password)
			if (response.success) {
				localStorage.token = response.authToken
				localStorage.agentId = response.agentId
				navigate('/agent/agentHome')
			} else if (response.status === 'pending') {
				setStatus('pending')
			} else {
				fail(response.error || 'Invalid email or password')
			}
		} catch {
			fail('Could not reach the server. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	const pickFile = (file) => {
		if (!file) return
		if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
			fail('Upload a PDF, JPG or PNG file')
			return
		}
		if (file.size > MAX_DOC_MB * 1024 * 1024) {
			fail(`The document must be smaller than ${MAX_DOC_MB} MB`)
			return
		}
		setError('')
		setApply((a) => ({ ...a, document: file }))
	}

	const handleApply = async (e) => {
		e.preventDefault()
		const { agentName, email, password, cpassword, document } = apply
		if (password !== cpassword) return fail('Passwords do not match')
		if (!document) return fail('Please upload a verification document')
		setError('')
		setLoading(true)
		try {
			const formData = new FormData()
			formData.append('agentName', agentName)
			formData.append('email', email)
			formData.append('password', password)
			formData.append('document', document)
			await createAgent(formData).unwrap()
			setApply(EMPTY_APPLY)
			setStatus('submitted')
		} catch (err) {
			fail(err?.data?.error || 'Could not submit your application. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	const onApplyInput = (e) => setApply({ ...apply, [e.target.name]: e.target.value })
	const mismatch = apply.cpassword && apply.cpassword !== apply.password

	return (
		<>
			<Navbar />
			<div className="auth-page auth-page--partner">
				<aside className="auth-visual" style={{ backgroundImage: `url('${tourPhotos.amer.src}')` }}>
					<div className="auth-visual-overlay" />
					<div className="auth-visual-content">
						<span className="auth-chip"><i className="fa fa-briefcase" /> Vihari for partners</span>
						<h2>{mode === 'login' ? 'Welcome back, partner' : 'Grow your travel business'}</h2>
						<p>List your buses and tour packages, manage bookings from one dashboard and reach travellers across India.</p>
					</div>
					<div className="auth-float auth-float--1"><i className="fa fa-bell" /><Ticker items={PARTNER_UPDATES} /></div>
					<div className="auth-float auth-float--2"><i className="fa fa-chart-line" /><div><strong>One dashboard</strong><span>Buses, tours and bookings</span></div></div>
					<div className="auth-float auth-float--3"><i className="fa fa-hand-holding-usd" /><div><strong>Secure payouts</strong><span>Powered by Razorpay</span></div></div>
				</aside>

				<main className="auth-panel">
					<div className="auth-card">
						{status === 'pending' && (
							<div className="auth-status">
								<img src={approvalImage} alt="" />
								<h1>Application under review</h1>
								<p>Thanks for applying! Our team is reviewing your documents. You can log in as soon as your account is approved.</p>
								<button type="button" className="auth-submit" onClick={() => setStatus(null)}>Back to login</button>
							</div>
						)}

						{status === 'submitted' && (
							<div className="auth-status">
								<div className="auth-status-icon"><i className="fa fa-check" /></div>
								<h1>Application submitted</h1>
								<p>We have received your details and document. Here is what happens next:</p>
								<ol className="auth-steps">
									<li><i className="fa fa-file-alt" /> We verify your document</li>
									<li><i className="fa fa-user-check" /> An admin approves your account</li>
									<li><i className="fa fa-bus" /> You log in and list your buses and tours</li>
								</ol>
								<button type="button" className="auth-submit" onClick={() => go('/agentLogin')}>Go to partner login</button>
							</div>
						)}

						{!status && (
							<>
								<div className="auth-tabs" role="tablist">
									<span className="auth-tabs-indicator" style={{ transform: mode === 'signup' ? 'translateX(100%)' : 'none' }} />
									<button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => go('/agentLogin')}>Partner login</button>
									<button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => go('/agentSignUp')}>Become a partner</button>
								</div>

								<div className="auth-head">
									<h1>{mode === 'login' ? 'Partner login' : 'Apply as a partner'}</h1>
									<p>{mode === 'login' ? 'Manage your buses, tours and bookings.' : 'Applications are usually reviewed within 24 hours.'}</p>
								</div>

								{error && <div className="auth-error" role="alert" key={shakeKey}><i className="fa fa-exclamation-circle" /> {error}</div>}

								{mode === 'login' ? (
									<form className="auth-form" onSubmit={handleLogin} key="login">
										<Field icon="fa fa-envelope" type="email" name="email" aria-label="Business email" value={loginCreds.email} onChange={(e) => setLoginCreds({ ...loginCreds, email: e.target.value })} required autoComplete="email" />
										<Field icon="fa fa-lock" type="password" toggle name="password" aria-label="Password" value={loginCreds.password} onChange={(e) => setLoginCreds({ ...loginCreds, password: e.target.value })} required autoComplete="current-password" />
										<button className="auth-submit" disabled={loading}>
											{loading ? <span className="auth-spinner" /> : <>Log in <i className="fa fa-arrow-right" /></>}
										</button>
										<button type="button" className="auth-demo" onClick={() => setLoginCreds(DEMO)}>
											<i className="fa fa-magic" /> Use demo partner account
										</button>
									</form>
								) : (
									<form className="auth-form" onSubmit={handleApply} key="signup">
										<Field icon="fa fa-building" name="agentName" aria-label="Agency name" value={apply.agentName} onChange={onApplyInput} required autoComplete="organization" />
										<Field icon="fa fa-envelope" type="email" name="email" aria-label="Business email" value={apply.email} onChange={onApplyInput} required autoComplete="email" />
										<Field icon="fa fa-lock" type="password" toggle name="password" aria-label="Password" value={apply.password} onChange={onApplyInput} required minLength={6} autoComplete="new-password" />
										<StrengthMeter password={apply.password} />
										<Field icon="fa fa-lock" type="password" toggle name="cpassword" aria-label="Confirm password" value={apply.cpassword} onChange={onApplyInput} required autoComplete="new-password" />
										{mismatch && <small className="auth-hint auth-hint--bad"><i className="fa fa-times-circle" /> Passwords do not match</small>}

										<div
											className={`auth-drop${dragging ? ' dragging' : ''}${apply.document ? ' has-file' : ''}`}
											onClick={() => fileInput.current?.click()}
											onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
											onDragLeave={() => setDragging(false)}
											onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
											role="button"
											tabIndex={0}
										>
											<input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={(e) => pickFile(e.target.files[0])} />
											<i className={apply.document ? 'fa fa-file-alt' : 'fa fa-cloud-upload-alt'} />
											{apply.document ? (
												<div>
													<strong>{apply.document.name}</strong>
													<span>{(apply.document.size / 1024 / 1024).toFixed(2)} MB · click to change</span>
												</div>
											) : (
												<div>
													<strong>Upload a verification document</strong>
													<span>GST or business licence · PDF, JPG or PNG up to {MAX_DOC_MB} MB</span>
												</div>
											)}
										</div>

										<button className="auth-submit" disabled={loading}>
											{loading ? <span className="auth-spinner" /> : <>Submit application <i className="fa fa-arrow-right" /></>}
										</button>
									</form>
								)}
							</>
						)}

						<Link to="/login" className="auth-agent">
							<i className="fa fa-suitcase-rolling" /> Booking a trip? <strong>Traveller login</strong>
						</Link>
					</div>
				</main>
			</div>
		</>
	)
}

export default PartnerAuth
