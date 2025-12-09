import React, { useState } from "react";
const field = [
  "category",
  "Subject",
  "merchant",
  "Date",
  "Amount",
  "Attachments",
];

const categoryOptions = [
  "Select a category",
  "FD",
  "share",
  "Mutual Funds",
  "Other",
];

const containerStyle: React.CSSProperties = {
  height: "100vh",
  backgroundColor: "rgb(40, 39, 39)",
  padding: "30px 30px 30px 0px",
};

const formStyle: React.CSSProperties = {
  backgroundColor: "rgb(0, 0, 0)",
  height: "100%",
  color: "rgb(205, 201, 200)",
  borderRadius: "20px",
  padding: " 3% 3% 3% 3%",
};

const hrStyle: React.CSSProperties = {
  border: "1px solid white",
  margin: "10px 0",
};

const fieldWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "15px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "10px",
  padding: "10px",
  width: "150px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  width: "40%",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  color: "rgb(205, 201, 200)",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 25px",
  borderRadius: "5px",
  border: "none",
  backgroundColor: "rgb(205, 201, 200)",
  color: "rgb(40, 39, 39)",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "16px",
};

const Expenses: React.FC = () => {
  const [formData, setFormData] = useState({
    category: categoryOptions[0],
    subject: "",
    merchant: "",
    date: "",
    amount: "",
    attachments: null as File | null,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    console.log(name, value, type);

    if (type === "file") {
      const files = (e.target as HTMLInputElement).files;
      setFormData((prevData) => ({
        ...prevData,
        [name]: files ? files[0] : null,
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // --- FRONTEND VALIDATION ---
    if (
      formData.category === "Select a category" ||
      !formData.subject ||
      !formData.date ||
      !formData.amount
    ) {
      alert(
        "Please fill out all required fields: Category, Subject, Date, and Amount."
      );
      return; // Stop the submission
    }

    console.log("Submitting data:", formData);

    // You would typically send this to your backend API
    // For file uploads, you often use FormData
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value) {
        data.append(key, value);
      }
    });

    // Example POST request
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        body: data, // Use FormData for multipart/form-data
      });
      if (response.ok) {
        console.log("Expense saved successfully!");
        // Optionally reset form or navigate away
      } else {
        console.error("Failed to save expense.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <>
      <div style={containerStyle}>
        <form style={formStyle} onSubmit={handleSubmit}>
          <h1>New expense</h1>
          <hr style={hrStyle} />
          {field.map((fieldName) => {
            return (
              <div key={fieldName} style={fieldWrapperStyle}>
                <label htmlFor={fieldName} style={labelStyle}>
                  {fieldName}
                </label>
                {fieldName === "category" ? (
                  <select
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    style={inputStyle}
                    value={formData.category}
                    onChange={handleChange}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : fieldName === "Attachments" ? (
                  <input
                    type="file"
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    style={inputStyle}
                    onChange={handleChange}
                  />
                ) : (
                  <input
                    type={
                      fieldName === "Total"
                        ? "number"
                        : fieldName === "Date"
                          ? "date"
                          : "text"
                    }
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    placeholder={`Enter your ${fieldName} here`}
                    style={inputStyle}
                    value={
                      formData[
                        fieldName.toLowerCase() as keyof typeof formData
                      ] as string
                    }
                    onChange={handleChange}
                  />
                )}
              </div>
            );
          })}
          <div style={{ textAlign: "right", marginTop: "20px" }}>
            <button type="submit" style={buttonStyle}>
              Submit Expense
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default Expenses;
