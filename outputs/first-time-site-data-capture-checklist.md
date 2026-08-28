# First-Time Site Data Capture Checklist

Purpose: use the first visit to build the permanent asset database for a new customer. This is one-time setup work before normal maintenance/checklist servicing starts.

## 1. Site And Customer Info

- Client name
- Site name
- Site address
- Contact person
- Contact number
- Email
- Site operation hours
- Access requirements
- Permit / induction requirement
- Parking / loading access notes

## 2. Floor / Area Setup

- Total floors / areas
- Area naming standard, for example Basement, Level 1, Roof, Pump Room
- Existing mimic panel available: yes / no
- Softcopy floor plan available: yes / no
- CAD / PDF / image available: yes / no
- If no softcopy, take clear photos of fabricated mimic panel at site
- Take photo of each mimic page / section straight-on
- Mark “You are here” location if available
- Record fire alarm zone references shown on mimic

## 3. Fire Alarm / Mimic Data

- Main fire alarm panel brand and model
- Panel location
- Number of zones / loops
- Zone list photo
- Mimic panel photo
- Device symbols shown on mimic
- Missing / unclear symbols to verify on site
- Existing device tags if any
- New app tag format: `Floor.Type.RunningNo-Zone`

## 4. Fire Extinguisher

- Scan Bomba QR / barcode
- Serial number
- Expiry date
- Location
- Type, for example ABC, CO2
- Capacity
- Brand
- Condition
- Wall bracket / cabinet condition
- Before photo
- Barcode photo if scan fails

## 5. Hose Reel / Wet Riser

- Hose reel location
- Cabinet condition
- Hose condition
- Nozzle condition
- Valve condition
- Pressure gauge reading if available
- Wet riser landing valve location
- Breeching inlet location
- Pump room relation if any

## 6. Fire Pump System

- Pump room location
- Pump type: duty / standby / jockey
- Pump brand
- Pump model
- Pump serial number
- Motor rating
- Controller brand/model
- Pressure setting
- Pump nameplate photo
- Controller panel photo
- Test drain / flow test location
- Remarks on condition

## 7. CO2 System

- Protected area
- Number of CO2 cylinders / units
- Cylinder serial number
- Cylinder capacity
- Cylinder pressure / weight if available
- Release panel location
- Manual release location
- Abort switch location
- Warning sign / sounder / beacon condition
- Pipe/nozzle layout photo
- Cylinder bank photo

## 8. Wet Chemical System

- Protected kitchen / hood area
- System brand
- Cylinder size
- Number of cylinders
- Cylinder serial number
- Number of nozzles
- Nozzle locations
- Hood name / hood number
- Hood size
- Duct / plenum coverage
- Manual pull station location
- Gas shut-off / interlock condition
- System panel / tag photo

## 9. Keluar Sign / Exit Sign

- Location
- Brand
- Type: maintained / non-maintained / LED / other
- Power source
- Direction arrow
- Condition
- Photo

## 10. Emergency Light

- Location
- Brand
- Type
- Battery type if visible
- Charging indicator condition
- Test button condition
- Light output condition
- Photo

## 11. Other Active / Passive Devices

- Manual call point / break glass
- Smoke detector
- Heat detector
- Flow switch
- Tamper switch
- Bell / sounder
- Beacon
- Fireman intercom
- Gas release panel
- Fire shutter / smoke curtain if any
- Any item not shown on mimic: mark as “request add device”

## 12. Data Quality Rules

- If device type is unclear, tag as `UNKNOWN`
- If zone is unclear, use `Z??`
- Every important asset should have at least one photo
- Nameplate photo is required for pump, CO2, wet chemical, and panels
- Barcode / QR photo is required for extinguisher if scan fails
- Use consistent floor and area naming
- Do not guess serial number, model, capacity, or zone

## 13. First-Time Survey Output

After the first visit, the system should produce:

- Site asset register
- Floor/area list
- Mimic/floor drawing review file
- Device list CSV
- Missing information list
- Photo reference folder
- Items needing admin confirmation
- Ready-to-use maintenance checklist for future service visits

## App Module Recommendation

Add a separate app mode called `First-Time Site Setup`.

This mode is different from normal maintenance. It focuses on collecting all asset data once, so future service reports can be faster, cleaner, and more accurate.
