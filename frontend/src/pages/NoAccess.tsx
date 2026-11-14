import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  AccessDescription,
  AccessIconBadge,
  AccessLabel,
  AccessPage,
  AuroraBackground,
  BackToDashboardLink,
  Card,
  Heading,
} from "../components/ui";

export default function NoAccess() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "No access";
    return () => {
      document.title = "Compliance Tracker";
    };
  }, []);

  return (
    <>
      <AuroraBackground />
      <AccessPage>
        <Card variant="restricted">
          <div className="space-y-5 text-center">
            <AccessIconBadge />
            <AccessLabel>Access restricted</AccessLabel>
            <Heading level={1} variant="access-title">You do not have access to this page</Heading>
            <AccessDescription>
              Your account does not have permission to open this page.
              {user && ` Signed in as ${user.role}.`}
            </AccessDescription>
            <BackToDashboardLink />
          </div>
        </Card>
      </AccessPage>
    </>
  );
}
