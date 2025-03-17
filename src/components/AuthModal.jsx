import React, { useState } from 'react';
import Modal from './Modal';
import { handleLogin, handleSignup, sendPasswordReset } from '../utils/auth';
import '../styles/authmodal.css'; // Import separate auth modal styles

function AuthModal({ isOpen, onClose }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLoginMode) {
        await handleLogin(email, password);
        onClose();
      } else {
        // The handleSignup function now forces sign-out and throws an error
        await handleSignup(email, password);
        // This point will never be reached because handleSignup throws an error.
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="auth-modal">
      <div className="modal-header">
        <h2>{isLoginMode ? 'התחברות' : 'הרשמה'}</h2>
      </div>
      <div className="modal-body">
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="דואר אלקטרוני"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
          />
          <input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="auth-input"
          />
          <button type="submit" className="auth-submit">
            {isLoginMode ? 'התחבר' : 'הרשם'}
          </button>
        </form>
        <p className="auth-switch">
          {isLoginMode ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsLoginMode(!isLoginMode);
              setErrorMessage('');
            }}
          >
            {isLoginMode ? 'הרשמה' : 'התחברות'}
          </a>
        </p>
        <p className="auth-reset">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              sendPasswordReset(email);
            }}
          >
            שכחת את הסיסמה?
          </a>
        </p>
        {errorMessage && <p className="auth-error">{errorMessage}</p>}
      </div>
    </Modal>
  );
}

export default AuthModal;
