import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, X, Sparkles, ArrowRight } from 'lucide-react';

const Auth = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onClose();
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSuccess('Check your email for the confirmation link!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        /* Allow scrolling inside the overlay on very small phones */
        overflowY: 'auto',
      }}
      className="auth-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="premium-card auth-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          padding: '1.5rem',
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
          /* Prevent modal from collapsing on very small screens */
          minWidth: 0,
          /* Don't transform on hover inside modal */
          transform: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            color: 'var(--text-tertiary)',
            padding: '0.375rem',
            borderRadius: '50%',
            transition: 'var(--transition)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '32px',
            minWidth: '32px',
          }}
          className="hover-bg"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Title section */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', paddingTop: '0.25rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.6875rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            marginBottom: '0.875rem',
            color: 'white',
            boxShadow: 'var(--shadow-md)',
          }}>
            <Sparkles size={22} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            marginBottom: '0.375rem',
            lineHeight: 1.2,
          }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}>
            {isLogin
              ? 'Enter your details to continue your journey.'
              : 'Start turning your chaos into clarity today.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.9375rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="email"
                required
                autoComplete="email"
                className="input-premium"
                style={{ paddingLeft: '2.625rem' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.9375rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="password"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="input-premium"
                style={{ paddingLeft: '2.625rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Error / success messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  color: 'hsl(0, 84%, 60%)',
                  fontSize: '0.875rem',
                  backgroundColor: 'hsla(0, 84%, 60%, 0.1)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsla(0, 84%, 60%, 0.2)',
                  wordBreak: 'break-word',
                }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  color: 'hsl(142, 76%, 36%)',
                  fontSize: '0.875rem',
                  backgroundColor: 'hsla(142, 76%, 36%, 0.1)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsla(142, 76%, 36%, 0.2)',
                }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.25rem', height: '3.25rem' }}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Get Started'}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        {/* Toggle login/signup */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </span>
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
            style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline', minHeight: 'auto' }}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </motion.div>
      <style>{`
        @media (max-width: 480px) {
          .auth-overlay {
            align-items: flex-start !important;
            padding: max(0.75rem, env(safe-area-inset-top)) 0.75rem max(0.75rem, env(safe-area-inset-bottom)) !important;
          }
          .auth-card {
            padding: 1.25rem !important;
            border-radius: var(--radius-md) !important;
            max-height: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Auth;
