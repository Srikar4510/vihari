import { useEffect, useState } from 'react'
import '../CSS/Auth.css'

// Input with an icon, a floating label and an optional show/hide toggle for passwords.
export const Field = ({ icon, type = 'text', toggle, ...props }) => {
	const [show, setShow] = useState(false)
	return (
		<div className="auth-field">
			<i className={`auth-field-icon ${icon}`} />
			<input {...props} type={toggle && show ? 'text' : type} placeholder=" " />
			<label>{props['aria-label']}</label>
			{toggle && (
				<button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
					<i className={show ? 'fa fa-eye-slash' : 'fa fa-eye'} />
				</button>
			)}
		</div>
	)
}

// 0-4 score from length and character variety.
const passwordStrength = (pw) => {
	let score = 0
	if (pw.length >= 8) score++
	if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
	if (/\d/.test(pw)) score++
	if (/[^A-Za-z0-9]/.test(pw)) score++
	return pw ? Math.max(score, 1) : 0
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

export const StrengthMeter = ({ password }) => {
	if (!password) return null
	const strength = passwordStrength(password)
	return (
		<div className={`auth-strength auth-strength--${strength}`}>
			<div className="auth-strength-bars">{[1, 2, 3, 4].map((n) => <span key={n} />)}</div>
			<small>{STRENGTH_LABELS[strength]}</small>
		</div>
	)
}

const TICK_MS = 3200

// Cycles through `items` every few seconds; `offset` staggers cards so they don't switch together.
export const Ticker = ({ items, offset = 0 }) => {
	const [i, setI] = useState(0)
	useEffect(() => {
		let timer
		const start = setTimeout(() => {
			setI((n) => (n + 1) % items.length)
			timer = setInterval(() => setI((n) => (n + 1) % items.length), TICK_MS)
		}, TICK_MS + offset)
		return () => {
			clearTimeout(start)
			clearInterval(timer)
		}
	}, [items, offset])
	return (
		<div className="auth-ticker" key={i}>
			<strong>{items[i].title}</strong>
			<span>{items[i].detail}</span>
		</div>
	)
}
