import { useAtomValue } from "jotai";
import {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CountryData,
  CountrySelectorDropdown,
  FlagImage,
  defaultCountries,
  usePhoneInput,
} from "react-international-phone";

import { Box, Button, Input, Portal, clsx } from "@axelor/ui";

import { Icon } from "@/components/icon";
import { i18n } from "@/services/client/i18n";
import { _findLocale, l10n } from "@/services/client/l10n";
import { FieldControl, FieldProps } from "../../builder";
import { useInput } from "../../builder/hooks";

import "react-international-phone/style.css";
import styles from "./phone.module.scss";

// Fallback country codes when country is not found in language code
const FALLBACK_COUNTRIES: Record<string, string> = {
  af: "za", // Afrikaans -> South Africa
  ar: "sa", // Arabic -> Saudi Arabia
  be: "by", // Belarusian -> Belarus
  bn: "bd", // Bengali -> Bangladesh
  bs: "ba", // Bosnian -> Bosnia and Herzegovina
  cs: "cz", // Czech -> Czech Republic
  da: "dk", // Danish -> Denmark
  el: "gr", // Greek -> Greece
  en: "us", // English -> United States
  et: "ee", // Estonian -> Estonia
  fa: "ir", // Persian -> Iran
  gu: "in", // Gujarati -> India
  he: "il", // Hebrew -> Israel
  hi: "in", // Hindi -> India
  ja: "jp", // Japanese -> Japan
  ko: "kr", // Korean -> South Korea
  ms: "my", // Malay -> Malaysia
  sv: "se", // Swedish -> Sweden
  uk: "ua", // Ukrainian -> Ukraine
  vi: "vn", // Vietnamese -> Vietnam
  zh: "cn", // Chinese -> China
};

export function Phone({
  inputProps,
  ...props
}: FieldProps<string> & {
  inputProps?: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "autoComplete" | "placeholder" | "onFocus"
  >;
}) {
  const { schema, readonly, widgetAtom, valueAtom, invalid } = props;
  const { uid, placeholder: _placeholder, widgetAttrs } = schema;
  const {
    placeholderNumberType,
    initialCountry,
    onlyCountries: _onlyCountries,
  }: {
    placeholderNumberType?: "FIXED_LINE" | "MOBILE";
    initialCountry?: string;
    onlyCountries?: string;
  } = widgetAttrs;

  const { attrs } = useAtomValue(widgetAtom);
  const { focus, required } = attrs;

  const locale = l10n.getLocale();

  const onlyCountries = useMemo(
    () =>
      _onlyCountries?.split(/\W+/).map((country) => country.toLowerCase()) ??
      [],
    [_onlyCountries],
  );

  const defaultCountry = useMemo(() => {
    let defaultCountry = initialCountry;

    if (!defaultCountry) {
      // If user locale has no country code, look for a match in `navigator.languages`.
      const [
        language,
        country = _findLocale(
          navigator.languages.filter((language) => language.split("-")[1]),
          locale,
          (language) => language.split("-")[0],
        )
          ?.split("-")[1]
          ?.toLowerCase(),
      ] = locale.split("-").map((value) => value.toLowerCase());
      defaultCountry = country ?? FALLBACK_COUNTRIES[language] ?? language;
    }

    if (onlyCountries.length && !onlyCountries.includes(defaultCountry)) {
      defaultCountry = onlyCountries[0];
    }

    return defaultCountry;
  }, [initialCountry, locale, onlyCountries]);

  const preferredCountries = useMemo(
    () => [
      ...new Set([
        defaultCountry,
        ...navigator.languages
          .map((language) => language.split("-")[1]?.toLowerCase())
          .filter(
            (country) =>
              country &&
              (!onlyCountries.length || onlyCountries.includes(country)),
          ),
      ]),
    ],
    [defaultCountry, onlyCountries],
  );

  const {
    text,
    onChange,
    onBlur: _onBlur,
    onKeyDown,
    setValue,
  } = useInput(valueAtom, {
    schema,
  });

  const {
    inputValue,
    phone,
    country,
    setCountry,
    handlePhoneValueChange,
    inputRef,
  } = usePhoneInput({
    defaultCountry,
    value: text,
    onChange: ({ phone, country }) => {
      // If case of only dial code, set empty value instead.
      onChange({
        target: { value: phone !== `+${country.dialCode}` ? phone : "" },
      } as ChangeEvent<HTMLInputElement>);
    },
  });

  // If case of only dial code, set empty value instead.
  const onBlur = useCallback(() => {
    _onBlur({
      target: { value: phone !== `+${country.dialCode}` ? phone : "" },
    } as FocusEvent<HTMLInputElement>);
  }, [_onBlur, country.dialCode, phone]);

  const placeholder = useMemo(() => {
    if (_placeholder) return _placeholder;

    const { format = ".".repeat(9), dialCode } = country;
    let phoneFormat = typeof format === "string" ? format : format.default;

    // Special case for French mobile phone numbers
    if (
      dialCode === "33" &&
      placeholderNumberType?.toUpperCase() === "MOBILE"
    ) {
      phoneFormat = phoneFormat.replace(".", "6");
    }

    let currentNumber = 0;
    const numbers = phoneFormat.replace(/\./g, () => `${++currentNumber % 10}`);
    const placeholder = `+${dialCode} ${numbers}`;

    return placeholder;
  }, [_placeholder, country, placeholderNumberType]);

  const buttonRef = useRef<HTMLButtonElement>(null);

  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const toggleDropdown = useCallback(
    () => setShowDropdown(!showDropdown),
    [showDropdown],
  );

  // Position for portaled dropdown
  const dropdownPos = useMemo(() => {
    if (!showDropdown) return {};
    const { top, left } = buttonRef.current?.getBoundingClientRect() ?? {};
    return { top, left };
  }, [showDropdown]);

  const countries = useMemo(() => {
    // Filter out countries that are not in `onlyCountries`, if specified.
    let countries = onlyCountries.length
      ? defaultCountries.filter((country) => onlyCountries.includes(country[1]))
      : defaultCountries;

    // Translate country names
    countries = countries.map((country) => {
      const [name, ...rest] = country;
      return [i18n.get(name), ...rest] as CountryData;
    });
    countries.sort((a, b) => a[0].localeCompare(b[0]));

    return countries;
  }, [onlyCountries]);

  const countryIso2 = useMemo(() => {
    const { iso2 } = country;
    return onlyCountries.length && !onlyCountries.includes(iso2)
      ? defaultCountry
      : iso2;
  }, [country, defaultCountry, onlyCountries]);

  const hasValue = text && text === phone;
  const showButton = hasValue || !readonly;

  return (
    <FieldControl {...props} className={styles.container}>
      <Box className={clsx(styles.phone, { [styles.readonly]: readonly })}>
        {showButton && (
          <>
            <Button
              ref={buttonRef}
              className={styles.country}
              onMouseDown={(event) => {
                event.preventDefault();
                if (event.button === 0) {
                  toggleDropdown();
                }
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                toggleDropdown();
              }}
              disabled={readonly}
            >
              <FlagImage iso2={countryIso2} />
              {!readonly && (
                <Icon icon={`arrow_drop_${showDropdown ? "up" : "down"}`} />
              )}
            </Button>
            {!readonly && (
              <Portal>
                <Box className={styles.dropdown} style={dropdownPos}>
                  <CountrySelectorDropdown
                    show={showDropdown}
                    selectedCountry={countryIso2}
                    onSelect={(country) => {
                      if (country.iso2 !== countryIso2) {
                        setValue(null);
                        setCountry(country.iso2);
                      }
                    }}
                    onClose={() => setShowDropdown(false)}
                    preferredCountries={preferredCountries}
                    countries={countries}
                  />
                </Box>
              </Portal>
            )}
          </>
        )}
        {readonly ? (
          <Box
            as="a"
            target="_blank"
            href={`tel:${phone}`}
            className={styles.link}
          >
            {hasValue && inputValue}
          </Box>
        ) : (
          <Input
            ref={inputRef}
            {...(focus && { key: "focused" })}
            data-input
            type="text"
            id={uid}
            autoFocus={focus}
            placeholder={placeholder}
            value={inputValue}
            invalid={invalid}
            required={required}
            onKeyDown={onKeyDown}
            onChange={handlePhoneValueChange}
            onBlur={onBlur}
            {...inputProps}
          />
        )}
      </Box>
    </FieldControl>
  );
}
