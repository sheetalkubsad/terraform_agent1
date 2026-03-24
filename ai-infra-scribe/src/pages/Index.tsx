import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to landing page since that's the main entry point
    navigate('/landing');
  }, [navigate]);

  // This component will redirect immediately, but we return null just in case
  return null;
};

export default Index;
