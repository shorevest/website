(() => {
  const DEFAULT_CONFIG = {
    forms: {
      en: {
        portalId: "YOUR_HUBSPOT_PORTAL_ID",
        formId: "YOUR_ENGLISH_FORM_ID",
      },
      zh: {
        portalId: "YOUR_HUBSPOT_PORTAL_ID",
        formId: "YOUR_CHINESE_FORM_ID",
      },
    },
    fieldNames: {
      email: "email",
      firstName: "firstname",
      lastName: "lastname",
      company: "company",
      jobTitle: "jobtitle",
      country: "country",
      language: "newsletter_language",
      source: "newsletter_source",
    },
    sourceValue: "shorevest_website",
    hutkCookieName: "hubspotutk",
    legalConsentSubscriptionTypeId: "",
    redirectUrl: "",
  };

  const I18N = {
    en: {
      progress: "Required fields completed",
      valid: "Looks good.",
      invalid: "This field is required.",
      ready: "Ready to submit",
    },
    zh: {
      progress: "必填项完成进度",
      valid: "填写正确。",
      invalid: "此项为必填项。",
      ready: "可提交",
    },
  };

  const config = window.SVPHubSpotSignupConfig || DEFAULT_CONFIG;

  function getCookie(name) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getFormConfig(language) {
    return config.forms?.[language] || config.forms?.en || null;
  }

  function getLocaleCopy(language) {
    return I18N[language] || I18N.en;
  }

  function setStatus(form, message, type) {
    const status = form.querySelector("[data-signup-status]");
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.state = type;
  }

  function clearStatus(form) {
    const status = form.querySelector("[data-signup-status]");
    if (!status) return;
    status.hidden = true;
    status.textContent = "";
    status.dataset.state = "";
  }

  function setSubmitting(form, submitting) {
    const submit = form.querySelector("[data-signup-submit]");
    if (!submit) return;
    submit.disabled = submitting;
    submit.setAttribute("aria-busy", String(submitting));
    form.classList.toggle("is-submitting", submitting);
  }

  function buildPayload(form, language) {
    const fieldNames = config.fieldNames || DEFAULT_CONFIG.fieldNames;
    const email = form.querySelector('[name="email"]')?.value.trim() || "";
    const firstName =
      form.querySelector('[name="firstName"]')?.value.trim() || "";
    const lastName =
      form.querySelector('[name="lastName"]')?.value.trim() || "";
    const company = form.querySelector('[name="company"]')?.value.trim() || "";
    const jobTitle =
      form.querySelector('[name="jobTitle"]')?.value.trim() || "";
    const country = form.querySelector('[name="country"]')?.value.trim() || "";
    const pageTitle = document.title;
    const pageUri = window.location.href;

    const fields = [
      { name: fieldNames.email, value: email },
      { name: fieldNames.firstName, value: firstName },
      { name: fieldNames.lastName, value: lastName },
      { name: fieldNames.company, value: company },
      { name: fieldNames.jobTitle, value: jobTitle },
      { name: fieldNames.country, value: country },
      { name: fieldNames.language, value: language },
      {
        name: fieldNames.source,
        value: config.sourceValue || DEFAULT_CONFIG.sourceValue,
      },
    ].filter((field) => field.name && field.value);

    const payload = {
      submittedAt: Date.now(),
      fields,
      context: {
        hutk: getCookie(config.hutkCookieName || DEFAULT_CONFIG.hutkCookieName),
        pageUri,
        pageName: pageTitle,
      },
    };

    if (config.legalConsentSubscriptionTypeId) {
      payload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: form.dataset.consentText || "",
          communications: [
            {
              value: true,
              subscriptionTypeId: Number(config.legalConsentSubscriptionTypeId),
              text: form.dataset.consentText || "",
            },
          ],
        },
      };
    }

    return payload;
  }

  function ensureEnhancementStyles() {
    if (document.getElementById("svp-signup-enhancements")) return;
    const style = document.createElement("style");
    style.id = "svp-signup-enhancements";
    style.textContent = `
      .su__progress { margin-bottom: 14px; }
      .su__progress-label { display:block; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.45); margin-bottom:8px; }
      .su__progress-track { width:100%; height:4px; background:rgba(255,255,255,.14); border-radius:999px; overflow:hidden; }
      .su__progress-fill { height:100%; width:0; background:var(--red); transition:width .25s ease; }
      .su__hint { margin-top:8px; font-size:12px; color:rgba(255,255,255,.45); }
      .su__field.is-invalid { border-bottom-color: rgba(61,112,112,.9); }
      .su__field.is-valid { border-bottom-color: rgba(255,255,255,.32); }
    `;
    document.head.appendChild(style);
  }

  function initFormInteractions(form) {
    ensureEnhancementStyles();

    const language = form.dataset.signupLanguage || "en";
    const copy = getLocaleCopy(language);
    const requiredInputs = Array.from(form.querySelectorAll("input[required]"));
    const submit = form.querySelector("[data-signup-submit]");

    if (!requiredInputs.length || !submit) return;

    const progress = document.createElement("div");
    progress.className = "su__progress";
    progress.innerHTML = `
      <span class="su__progress-label">${copy.progress}: 0/${requiredInputs.length}</span>
      <div class="su__progress-track" aria-hidden="true">
        <div class="su__progress-fill"></div>
      </div>
    `;

    const consent = form.querySelector(".su__small");
    form.insertBefore(progress, consent || submit);

    const progressLabel = progress.querySelector(".su__progress-label");
    const progressFill = progress.querySelector(".su__progress-fill");

    const updateFieldState = (input) => {
      const wrap = input.closest(".su__field");
      if (!wrap) return;

      let hint = wrap.querySelector(".su__hint");
      if (!hint) {
        hint = document.createElement("p");
        hint.className = "su__hint";
        wrap.appendChild(hint);
      }

      const touched = input.dataset.touched === "true";
      const hasValue = input.value.trim().length > 0;
      const valid = input.checkValidity();

      wrap.classList.toggle("is-valid", valid && hasValue);
      wrap.classList.toggle("is-invalid", touched && !valid);

      if (!touched) {
        hint.textContent = "";
      } else if (valid && hasValue) {
        hint.textContent = copy.valid;
      } else {
        hint.textContent = input.validationMessage || copy.invalid;
      }
    };

    const updateProgress = () => {
      const validCount = requiredInputs.filter((input) => input.checkValidity()).length;
      const percent = Math.round((validCount / requiredInputs.length) * 100);

      progressLabel.textContent = `${copy.progress}: ${validCount}/${requiredInputs.length}${
        validCount === requiredInputs.length ? ` · ${copy.ready}` : ""
      }`;
      progressFill.style.width = `${percent}%`;
      submit.disabled = validCount !== requiredInputs.length;
    };

    requiredInputs.forEach((input) => {
      updateFieldState(input);
      input.addEventListener("input", () => {
        updateFieldState(input);
        updateProgress();
      });
      input.addEventListener("blur", () => {
        input.dataset.touched = "true";
        updateFieldState(input);
        updateProgress();
      });
    });

    updateProgress();
    form.addEventListener("reset", () => {
      requiredInputs.forEach((input) => {
        delete input.dataset.touched;
        const wrap = input.closest(".su__field");
        if (wrap) {
          wrap.classList.remove("is-valid", "is-invalid");
          const hint = wrap.querySelector(".su__hint");
          if (hint) hint.textContent = "";
        }
      });
      updateProgress();
    });
  }

  async function submitToHubSpot(form) {
    const language = form.dataset.signupLanguage || "en";
    const messages = JSON.parse(form.dataset.messages || "{}");
    const formConfig = getFormConfig(language);

    if (
      !formConfig?.portalId ||
      !formConfig?.formId ||
      String(formConfig.portalId).includes("YOUR_") ||
      String(formConfig.formId).includes("YOUR_")
    ) {
      throw new Error(
        messages.notConfigured || "HubSpot signup is not configured yet.",
      );
    }

    const response = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${formConfig.portalId}/${formConfig.formId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(form, language)),
      },
    );

    if (!response.ok) {
      let detail = "";
      try {
        const data = await response.json();
        detail = data?.message || data?.errors?.[0]?.message || "";
      } catch (error) {
        detail = "";
      }
      throw new Error(
        detail || messages.error || "Unable to submit the form right now.",
      );
    }

    return response.json().catch(() => ({}));
  }

  document.querySelectorAll("[data-newsletter-signup]").forEach((form) => {
    initFormInteractions(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus(form);

      if (!form.reportValidity()) return;

      const messages = JSON.parse(form.dataset.messages || "{}");
      setSubmitting(form, true);

      try {
        await submitToHubSpot(form);
        form.reset();
        setStatus(
          form,
          messages.success || "Thanks for subscribing.",
          "success",
        );

        if (config.redirectUrl) {
          window.location.assign(config.redirectUrl);
        }
      } catch (error) {
        setStatus(
          form,
          error.message ||
            messages.error ||
            "Unable to submit the form right now.",
          "error",
        );
      } finally {
        setSubmitting(form, false);
      }
    });
  });
})();
