// OLD FILE - FOR REGISTERING. NOT USED ANY MORE.

// import { useState } from 'react';
// import { useNavigate, Link } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';

// export default function Register() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { register } = useAuth();
//   const navigate = useNavigate();

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setError('');

//     if (password !== confirmPassword) {
//       setError('Passwords do not match');
//       return;
//     }

//     if (password.length < 6) {
//       setError('Password must be at least 6 characters');
//       return;
//     }

//     setLoading(true);

//     try {
//       await register(email, password);
//       navigate('/dashboard');
//     } catch (err: any) {
//       setError(err.response?.data?.error || 'Registration failed');
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="auth-container">
//       <div className="auth-card">
//         <h1>IntraDesk KB</h1>
//         <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>Create Account</h2>

//         {error && (
//           <div className="alert alert-danger">
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleSubmit}>
//           <div className="form-group">
//             <label htmlFor="email">Email</label>
//             <input
//               type="email"
//               id="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//               autoComplete="email"
//               placeholder="you@company.com"
//             />
//           </div>

//           <div className="form-group">
//             <label htmlFor="password">Password</label>
//             <input
//               type="password"
//               id="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//               autoComplete="new-password"
//               placeholder="••••••••"
//             />
//           </div>

//           <div className="form-group">
//             <label htmlFor="confirmPassword">Confirm Password</label>
//             <input
//               type="password"
//               id="confirmPassword"
//               value={confirmPassword}
//               onChange={(e) => setConfirmPassword(e.target.value)}
//               required
//               autoComplete="new-password"
//               placeholder="••••••••"
//             />
//           </div>

//           <button type="submit" className="btn btn-primary" disabled={loading}>
//             {loading ? 'Creating account...' : 'Create Account'}
//           </button>
//         </form>

//         <p style={{ textAlign: 'center', marginTop: '1rem', color: '#666' }}>
//           Already have an account? <Link to="/login" style={{ color: '#667eea' }}>Sign In</Link>
//         </p>
//       </div>
//     </div>
//   );
// }
