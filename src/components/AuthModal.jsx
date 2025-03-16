import React, { useState } from 'react';
import Modal from './Modal';
import { handleLogin, handleSignup, sendPasswordReset } from '../utils/auth';

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
      } else {
        await handleSignup(email, password);
      }
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal-header">
        <h2>{isLoginMode ? 'התחברות' : 'הרשמה'}</h2>
      </div>
      <div className="modal-body">
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="דואר אלקטרוני"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">{isLoginMode ? 'התחבר' : 'הרשם'}</button>
        </form>
        <p>
          {isLoginMode ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsLoginMode(!isLoginMode);
            }}
          >
            {isLoginMode ? 'הרשמה' : 'התחברות'}
          </a>
        </p>
        <p>
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
        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
      </div>
    </Modal>
  );
}

export default AuthModal;
