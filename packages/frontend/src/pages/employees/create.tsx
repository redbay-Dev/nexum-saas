import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useCreateEmployee } from "@frontend/api/employees.js";
import type { EmergencyContact } from "@frontend/api/employees.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { toast } from "sonner";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
  { value: "salary", label: "Salary" },
  { value: "wages", label: "Wages" },
];

export function CreateEmployeePage(): React.JSX.Element {
  const navigate = useNavigate();
  const createEmployee = useCreateEmployee();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [position, setPosition] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [startDate, setStartDate] = useState("");
  const [department, setDepartment] = useState("");
  const [isDriver, setIsDriver] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContact[]
  >([]);

  function addEmergencyContact(): void {
    setEmergencyContacts([
      ...emergencyContacts,
      { name: "", relationship: "", phone: "" },
    ]);
  }

  function updateEmergencyContact(
    index: number,
    field: keyof EmergencyContact,
    value: string,
  ): void {
    const updated = [...emergencyContacts];
    const contact = updated[index];
    if (contact) {
      contact[field] = value;
      setEmergencyContacts(updated);
    }
  }

  function removeEmergencyContact(index: number): void {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();

    createEmployee.mutate(
      {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || undefined,
        phone: phone || undefined,
        email: email || undefined,
        homeAddress: homeAddress || undefined,
        position,
        employmentType,
        startDate,
        department: department || undefined,
        isDriver,
        emergencyContacts: emergencyContacts.filter(
          (c) => c.name && c.phone,
        ),
      },
      {
        onSuccess: () => {
          toast.success(`Created "${firstName} ${lastName}"`);
          void navigate("/employees");
        },
        onError: () => toast.error("Failed to create employee"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/employees">
            <ArrowLeft className="h-4 w-4" />
            Back to employees
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">Add Employee</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new employee or driver record.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            {/* Personal Details */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  className="h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  className="h-11"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="h-11"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  className="h-11"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+61412345678"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com.au"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homeAddress">Home address</Label>
                <Input
                  id="homeAddress"
                  className="h-11"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder="123 Main St, Brisbane QLD 4000"
                />
              </div>
            </div>

            {/* Employment Details */}
            <div className="border-t pt-5">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Employment Details
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="position">Position / Role</Label>
                  <Input
                    id="position"
                    className="h-11"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Driver, Yard Staff, Mechanic"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    className="h-11"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Operations, Maintenance"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employment type</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {EMPLOYMENT_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={
                        employmentType === type.value
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => setEmploymentType(type.value)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  className="h-11"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isDriver"
                checked={isDriver}
                onChange={(e) => setIsDriver(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isDriver" className="font-normal">
                This employee is a driver (operates vehicles)
              </Label>
            </div>

            {/* Emergency Contacts */}
            <div className="border-t pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Emergency Contacts
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmergencyContact}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {emergencyContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No emergency contacts added.
                </p>
              ) : (
                <div className="space-y-3">
                  {emergencyContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="grid flex-1 gap-3 sm:grid-cols-3">
                        <Input
                          placeholder="Name"
                          value={contact.name}
                          onChange={(e) =>
                            updateEmergencyContact(
                              index,
                              "name",
                              e.target.value,
                            )
                          }
                        />
                        <Input
                          placeholder="Relationship"
                          value={contact.relationship}
                          onChange={(e) =>
                            updateEmergencyContact(
                              index,
                              "relationship",
                              e.target.value,
                            )
                          }
                        />
                        <Input
                          placeholder="Phone"
                          type="tel"
                          value={contact.phone}
                          onChange={(e) =>
                            updateEmergencyContact(
                              index,
                              "phone",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmergencyContact(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <Button variant="outline" asChild>
              <Link to="/employees">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createEmployee.isPending}>
              {createEmployee.isPending
                ? "Creating..."
                : "Create Employee"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
