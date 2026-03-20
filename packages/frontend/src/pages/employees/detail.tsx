import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Trash2,
  X,
} from "lucide-react";
import {
  useEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useCreateLicence,
  useDeleteLicence,
  useCreateMedical,
  useDeleteMedical,
  useCreateQualification,
  useDeleteQualification,
} from "@frontend/api/employees.js";
import type { EmergencyContact } from "@frontend/api/employees.js";
import { useQualificationTypes } from "@frontend/api/qualification-types.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { toast } from "sonner";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
  { value: "salary", label: "Salary" },
  { value: "wages", label: "Wages" },
];

const LICENCE_CLASSES = ["C", "LR", "MR", "HR", "HC", "MC"] as const;
const AU_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "outline",
  suspended: "secondary",
  terminated: "destructive",
};

function ComplianceBadge({
  status,
}: {
  status: "compliant" | "non_compliant" | "expiring_soon" | null;
}): React.JSX.Element | null {
  if (!status) return null;
  if (status === "compliant") {
    return (
      <Badge variant="default" className="bg-green-600">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Compliant
      </Badge>
    );
  }
  if (status === "expiring_soon") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        <ShieldAlert className="mr-1 h-3 w-3" />
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <ShieldX className="mr-1 h-3 w-3" />
      Non-Compliant
    </Badge>
  );
}

export function EmployeeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: employee, isPending, error } = useEmployee(id ?? "");
  const updateEmployee = useUpdateEmployee(id ?? "");
  const deleteEmployee = useDeleteEmployee();
  const { data: qualTypesData } = useQualificationTypes();

  // Employee form state
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
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  // Licence form state
  const [showLicenceForm, setShowLicenceForm] = useState(false);
  const [licClass, setLicClass] = useState<string>("HR");
  const [licNumber, setLicNumber] = useState("");
  const [licState, setLicState] = useState<string>("QLD");
  const [licExpiry, setLicExpiry] = useState("");
  const [licConditions, setLicConditions] = useState("");

  // Medical form state
  const [showMedicalForm, setShowMedicalForm] = useState(false);
  const [medCertNumber, setMedCertNumber] = useState("");
  const [medIssued, setMedIssued] = useState("");
  const [medExpiry, setMedExpiry] = useState("");
  const [medConditions, setMedConditions] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // Qualification form state
  const [showQualForm, setShowQualForm] = useState(false);
  const [qualTypeId, setQualTypeId] = useState("");
  const [qualRef, setQualRef] = useState("");
  const [qualState, setQualState] = useState("");
  const [qualIssued, setQualIssued] = useState("");
  const [qualExpiry, setQualExpiry] = useState("");
  const [qualNotes, setQualNotes] = useState("");

  const createLicence = useCreateLicence(id ?? "");
  const deleteLicence = useDeleteLicence(id ?? "");
  const createMedical = useCreateMedical(id ?? "");
  const deleteMedical = useDeleteMedical(id ?? "");
  const createQualification = useCreateQualification(id ?? "");
  const deleteQualification = useDeleteQualification(id ?? "");

  useEffect(() => {
    if (employee) {
      setFirstName(employee.firstName);
      setLastName(employee.lastName);
      setDateOfBirth(employee.dateOfBirth ?? "");
      setPhone(employee.phone ?? "");
      setEmail(employee.email ?? "");
      setHomeAddress(employee.homeAddress ?? "");
      setPosition(employee.position);
      setEmploymentType(employee.employmentType);
      setStartDate(employee.startDate);
      setDepartment(employee.department ?? "");
      setIsDriver(employee.isDriver);
      setEmergencyContacts(employee.emergencyContacts);
    }
  }, [employee]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    updateEmployee.mutate(
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
        emergencyContacts: emergencyContacts.filter((c) => c.name && c.phone),
      },
      {
        onSuccess: () => toast.success("Employee updated"),
        onError: () => toast.error("Failed to update employee"),
      },
    );
  }

  function handleDelete(): void {
    if (!employee) return;
    if (
      !confirm(
        `Are you sure you want to delete "${employee.firstName} ${employee.lastName}"?`,
      )
    )
      return;
    deleteEmployee.mutate(employee.id, {
      onSuccess: () => {
        toast.success("Employee deleted");
        void navigate("/employees");
      },
      onError: () => toast.error("Failed to delete employee"),
    });
  }

  function handleAddLicence(e: React.FormEvent): void {
    e.preventDefault();
    createLicence.mutate(
      {
        licenceClass: licClass,
        licenceNumber: licNumber,
        stateOfIssue: licState,
        expiryDate: licExpiry,
        conditions: licConditions || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Licence added");
          setShowLicenceForm(false);
          setLicNumber("");
          setLicExpiry("");
          setLicConditions("");
        },
        onError: () => toast.error("Failed to add licence"),
      },
    );
  }

  function handleAddMedical(e: React.FormEvent): void {
    e.preventDefault();
    createMedical.mutate(
      {
        certificateNumber: medCertNumber || undefined,
        issuedDate: medIssued,
        expiryDate: medExpiry,
        conditions: medConditions || undefined,
        notes: medNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Medical record added");
          setShowMedicalForm(false);
          setMedCertNumber("");
          setMedIssued("");
          setMedExpiry("");
          setMedConditions("");
          setMedNotes("");
        },
        onError: () => toast.error("Failed to add medical record"),
      },
    );
  }

  function handleAddQualification(e: React.FormEvent): void {
    e.preventDefault();
    createQualification.mutate(
      {
        qualificationTypeId: qualTypeId,
        referenceNumber: qualRef || undefined,
        stateOfIssue: qualState || undefined,
        issuedDate: qualIssued || undefined,
        expiryDate: qualExpiry || undefined,
        notes: qualNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Qualification added");
          setShowQualForm(false);
          setQualTypeId("");
          setQualRef("");
          setQualState("");
          setQualIssued("");
          setQualExpiry("");
          setQualNotes("");
        },
        onError: () => toast.error("Failed to add qualification"),
      },
    );
  }

  function addEmergencyContact(): void {
    setEmergencyContacts([
      ...emergencyContacts,
      { name: "", relationship: "", phone: "" },
    ]);
  }

  function updateEmergencyContactField(
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

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          Employee not found.{" "}
          <Link to="/employees" className="underline">
            Back to employees
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = can("manage:drivers");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/employees">
            <ArrowLeft className="h-4 w-4" />
            Back to employees
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <ComplianceBadge status={employee.complianceStatus} />
          <Badge variant={STATUS_VARIANT[employee.status] ?? "secondary"}>
            {employee.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      {/* Employee Details Card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee.position}
            {employee.department ? ` · ${employee.department}` : ""}
            {" · "}
            Created {new Date(employee.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  className="h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  className="h-11"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={!canEdit}
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
                  disabled={!canEdit}
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
                  disabled={!canEdit}
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
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homeAddress">Home address</Label>
                <Input
                  id="homeAddress"
                  className="h-11"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Employment Details
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    className="h-11"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    required
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    className="h-11"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={!canEdit}
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
                        employmentType === type.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setEmploymentType(type.value)}
                      disabled={!canEdit}
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
                  disabled={!canEdit}
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
                disabled={!canEdit}
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
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmergencyContact}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                ) : null}
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
                            updateEmergencyContactField(
                              index,
                              "name",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                        />
                        <Input
                          placeholder="Relationship"
                          value={contact.relationship}
                          onChange={(e) =>
                            updateEmergencyContactField(
                              index,
                              "relationship",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                        />
                        <Input
                          placeholder="Phone"
                          type="tel"
                          value={contact.phone}
                          onChange={(e) =>
                            updateEmergencyContactField(
                              index,
                              "phone",
                              e.target.value,
                            )
                          }
                          disabled={!canEdit}
                        />
                      </div>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmergencyContact(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {canEdit ? (
            <div className="flex justify-between border-t px-8 py-5">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteEmployee.isPending}
              >
                Delete
              </Button>
              <Button type="submit" disabled={updateEmployee.isPending}>
                {updateEmployee.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>

      {/* Driver-specific sections */}
      {employee.isDriver ? (
        <>
          {/* Licences */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-8 py-5">
              <h3 className="font-semibold">Licences</h3>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLicenceForm(!showLicenceForm)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Licence
                </Button>
              ) : null}
            </div>

            {showLicenceForm && canEdit ? (
              <form
                onSubmit={handleAddLicence}
                className="border-b bg-muted/30 px-8 py-5"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <div className="flex flex-wrap gap-1">
                      {LICENCE_CLASSES.map((cls) => (
                        <Button
                          key={cls}
                          type="button"
                          variant={licClass === cls ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLicClass(cls)}
                        >
                          {cls}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Licence number</Label>
                    <Input
                      value={licNumber}
                      onChange={(e) => setLicNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State of issue</Label>
                    <div className="flex flex-wrap gap-1">
                      {AU_STATES.map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={licState === s ? "default" : "outline"}
                          size="sm"
                          className="px-2 text-xs"
                          onClick={() => setLicState(s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry date</Label>
                    <Input
                      type="date"
                      value={licExpiry}
                      onChange={(e) => setLicExpiry(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Label>Conditions</Label>
                  <Input
                    value={licConditions}
                    onChange={(e) => setLicConditions(e.target.value)}
                    placeholder="Any licence conditions or restrictions"
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLicenceForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createLicence.isPending}
                  >
                    {createLicence.isPending ? "Adding..." : "Add Licence"}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="px-8 py-4">
              {employee.licences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No licences recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {employee.licences.map((lic) => {
                    const isExpired = new Date(lic.expiryDate) < new Date();
                    return (
                      <div
                        key={lic.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={isExpired ? "destructive" : "default"}>
                            {lic.licenceClass}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {lic.licenceNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lic.stateOfIssue} · Expires{" "}
                              {new Date(lic.expiryDate).toLocaleDateString(
                                "en-AU",
                              )}
                              {lic.conditions
                                ? ` · ${lic.conditions}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  "Delete this licence?",
                                )
                              ) {
                                deleteLicence.mutate(lic.id, {
                                  onSuccess: () =>
                                    toast.success("Licence deleted"),
                                  onError: () =>
                                    toast.error(
                                      "Failed to delete licence",
                                    ),
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Medical Certificates */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-8 py-5">
              <h3 className="font-semibold">Medical Certificates</h3>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMedicalForm(!showMedicalForm)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Medical
                </Button>
              ) : null}
            </div>

            {showMedicalForm && canEdit ? (
              <form
                onSubmit={handleAddMedical}
                className="border-b bg-muted/30 px-8 py-5"
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Certificate number</Label>
                    <Input
                      value={medCertNumber}
                      onChange={(e) => setMedCertNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Issued date</Label>
                    <Input
                      type="date"
                      value={medIssued}
                      onChange={(e) => setMedIssued(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry date</Label>
                    <Input
                      type="date"
                      value={medExpiry}
                      onChange={(e) => setMedExpiry(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Conditions</Label>
                    <Input
                      value={medConditions}
                      onChange={(e) => setMedConditions(e.target.value)}
                      placeholder="Any medical conditions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={medNotes}
                      onChange={(e) => setMedNotes(e.target.value)}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMedicalForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMedical.isPending}
                  >
                    {createMedical.isPending ? "Adding..." : "Add Medical"}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="px-8 py-4">
              {employee.medicals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No medical records.
                </p>
              ) : (
                <div className="space-y-3">
                  {employee.medicals.map((med) => {
                    const isExpired = new Date(med.expiryDate) < new Date();
                    return (
                      <div
                        key={med.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {med.certificateNumber ?? "Medical Certificate"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Issued{" "}
                            {new Date(med.issuedDate).toLocaleDateString(
                              "en-AU",
                            )}{" "}
                            · Expires{" "}
                            <span
                              className={
                                isExpired ? "text-destructive font-medium" : ""
                              }
                            >
                              {new Date(med.expiryDate).toLocaleDateString(
                                "en-AU",
                              )}
                            </span>
                            {med.conditions
                              ? ` · ${med.conditions}`
                              : ""}
                          </p>
                        </div>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                confirm("Delete this medical record?")
                              ) {
                                deleteMedical.mutate(med.id, {
                                  onSuccess: () =>
                                    toast.success("Medical record deleted"),
                                  onError: () =>
                                    toast.error(
                                      "Failed to delete medical record",
                                    ),
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Qualifications (for all employees) */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-8 py-5">
          <h3 className="font-semibold">Qualifications</h3>
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQualForm(!showQualForm)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Qualification
            </Button>
          ) : null}
        </div>

        {showQualForm && canEdit ? (
          <form
            onSubmit={handleAddQualification}
            className="border-b bg-muted/30 px-8 py-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Qualification type</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={qualTypeId}
                  onChange={(e) => setQualTypeId(e.target.value)}
                  required
                >
                  <option value="">Select type...</option>
                  {qualTypesData?.data.map((qt) => (
                    <option key={qt.id} value={qt.id}>
                      {qt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Reference number</Label>
                <Input
                  value={qualRef}
                  onChange={(e) => setQualRef(e.target.value)}
                  placeholder="e.g. card number"
                />
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>State of issue</Label>
                <div className="flex flex-wrap gap-1">
                  {AU_STATES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={qualState === s ? "default" : "outline"}
                      size="sm"
                      className="px-2 text-xs"
                      onClick={() => setQualState(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Issued date</Label>
                <Input
                  type="date"
                  value={qualIssued}
                  onChange={(e) => setQualIssued(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={qualExpiry}
                  onChange={(e) => setQualExpiry(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label>Notes</Label>
              <Input
                value={qualNotes}
                onChange={(e) => setQualNotes(e.target.value)}
                placeholder="Additional notes"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQualForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createQualification.isPending}
              >
                {createQualification.isPending
                  ? "Adding..."
                  : "Add Qualification"}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="px-8 py-4">
          {employee.qualifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No qualifications recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {employee.qualifications.map((qual) => {
                const isExpired = qual.expiryDate
                  ? new Date(qual.expiryDate) < new Date()
                  : false;
                return (
                  <div
                    key={qual.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {qual.qualificationTypeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {qual.referenceNumber
                          ? `${qual.referenceNumber} · `
                          : ""}
                        {qual.stateOfIssue
                          ? `${qual.stateOfIssue} · `
                          : ""}
                        {qual.expiryDate ? (
                          <>
                            Expires{" "}
                            <span
                              className={
                                isExpired
                                  ? "text-destructive font-medium"
                                  : ""
                              }
                            >
                              {new Date(
                                qual.expiryDate,
                              ).toLocaleDateString("en-AU")}
                            </span>
                          </>
                        ) : (
                          "No expiry"
                        )}
                      </p>
                    </div>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm("Delete this qualification?")
                          ) {
                            deleteQualification.mutate(qual.id, {
                              onSuccess: () =>
                                toast.success("Qualification deleted"),
                              onError: () =>
                                toast.error(
                                  "Failed to delete qualification",
                                ),
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
