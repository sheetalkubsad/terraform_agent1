import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Bot, Shield, User } from "lucide-react";

const AccountSelection = () => {
  const navigate = useNavigate();

  const accounts = [
    {
      id: "admin",
      name: "Platform Engineer",
      email: "platform.engineer@miraclesoft.ai",
      access: "Full access",
      role: "ADMIN",
      icon: Shield,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      id: "developer", 
      name: "Product Development",
      email: "product.dev@miraclesoft.ai",
      access: "Standard access", 
      role: "USER",
      icon: User,
      bgColor: "bg-slate-100",
      iconColor: "text-slate-600"
    }
  ];

  const handleAccountSelect = (accountId: string) => {
    // Since there's no backend, just navigate to the console/main app
    navigate('/console');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Platform AI</h1>
          <p className="text-slate-600">Select a test account to continue</p>
        </div>

        {/* Account Cards */}
        <div className="space-y-4 mb-8">
          {accounts.map((account) => (
            <Card 
              key={account.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-white/80 backdrop-blur-sm border-slate-200"
              onClick={() => handleAccountSelect(account.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${account.bgColor} rounded-lg flex items-center justify-center`}>
                  <account.icon className={`w-6 h-6 ${account.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">{account.name}</h3>
                    <span 
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        account.role === 'ADMIN' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {account.role}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {account.email} · {account.access}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Demo Notice */}
        <div className="text-center text-sm text-slate-500 mb-6">
          These are demo accounts for testing purposes only
        </div>

        {/* Back Button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/landing')}
        >
          Back to Landing
        </Button>
      </div>
    </div>
  );
};

export default AccountSelection;