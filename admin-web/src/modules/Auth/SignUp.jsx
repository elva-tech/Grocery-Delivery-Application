import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Signup is intentionally disabled for now.
 * Keep this placeholder so existing imports/routes do not break production builds.
 */
const SignUp = () => {
  return <Navigate to="/login" replace />;
};

export default SignUp;
