require 'json'
require 'fileutils'

RSpec.describe 'ARC Raiders layouts' do
  fixture = JSON.parse(File.read(File.join(__dir__, 'fixtures/schedule.json')))
  now = '2026-11-17T18:15:00Z'
  epoch = Time.iso8601(now).to_i * 1000
  crowded = Marshal.load(Marshal.dump(fixture))
  crowded['data'] += fixture['data'].drop(4).map { it.merge('startTime' => epoch - 600000, 'endTime' => epoch + 3600000) }
  long_names = Marshal.load(Marshal.dump(fixture))
  long_names['data'][0].merge!('name' => 'Electromagnetic Storm', 'map' => 'Dam Battlegrounds', 'endTime' => epoch + 60000)
  long_names['data'][1]['name'] = 'An unfamiliar condition with a very long name & <script>alert(1)</script>'
  long_names['region'] = 'north-america'
  overnight = Marshal.load(Marshal.dump(fixture))
  overnight['data'].each { it['startTime'] += 4 * 3600000; it['endTime'] += 4 * 3600000 }
  overnight['cachedAt'] += 4 * 3600000
  fallback = {
    'region' => 'europe',
    'data' => [
      { 'name' => 'Night Raid', 'map' => 'Dam',
        'startTime' => Time.iso8601('2026-10-25T00:00:00Z').to_i * 1000,
        'endTime' => Time.iso8601('2026-10-25T01:00:00Z').to_i * 1000 },
      { 'name' => 'Cold Snap', 'map' => 'Spaceport',
        'startTime' => Time.iso8601('2026-10-25T00:30:00Z').to_i * 1000,
        'endTime' => Time.iso8601('2026-10-25T01:30:00Z').to_i * 1000 }
    ]
  }
  late_condition = {
    'region' => 'north-america',
    'data' => [{ 'name' => 'Electromagnetic Storm', 'map' => 'Dam Battlegrounds',
                 'startTime' => epoch + 86340000, 'endTime' => epoch + 89940000 }]
  }
  fifth_active = fixture['data'][4].merge('startTime' => epoch - 600000, 'endTime' => epoch + 3600000)
  cases = {
    'ordinary' => [fixture, now],
    'three-active' => [fixture.merge('data' => fixture['data'].take(3) + fixture['data'].drop(4)), now],
    'crowded' => [crowded, now],
    'long-names' => [long_names, now],
    'empty' => [fixture.merge('data' => []), now],
    'unavailable' => [fixture.merge('data' => { 'error' => 'backend down' }), now],
    'stale' => [fixture.merge('cachedAt' => epoch - 4 * 3600000), now],
    'overnight' => [overnight, '2026-11-17T22:15:00Z'],
    'dst-fallback' => [fallback, '2026-10-25T00:15:00Z'],
    'long-countdown' => [late_condition, now],
    'future-only' => [fixture.merge('data' => fixture['data'].drop(4)), now],
    'active-only' => [fixture.merge('data' => fixture['data'].take(4)), now],
    'five-active' => [fixture.merge('data' => fixture['data'].take(4) + [fifth_active] + fixture['data'].drop(5)), now]
  }
  views = %w[full half_horizontal half_vertical quadrant]
  devices = {
    'og' => { model: 'og_png', width: 800, height: 480, bit_depth: 1, screen_classes: 'screen screen--og_png screen--md screen--1bit' },
    'x' => { model: 'v2', width: 1872, height: 1404, bit_depth: 4, screen_classes: 'screen screen--v2 screen--lg screen--4bit' },
    'x-portrait' => { model: 'v2', width: 1404, height: 1872, bit_depth: 4, screen_classes: 'screen screen--v2 screen--lg screen--4bit screen--portrait' },
    'og-portrait' => { model: 'og_plus', width: 480, height: 800, bit_depth: 2, screen_classes: 'screen screen--ogv2 screen--md screen--2bit screen--portrait' },
    'og-2bit' => { model: 'og_plus', width: 800, height: 480, bit_depth: 2, screen_classes: 'screen screen--ogv2 screen--md screen--2bit' }
  }
  capacities = {
    'og' => [7, 3, 8, 3], 'x' => [9, 4, 10, 4], 'x-portrait' => [12, 6, 14, 6],
    'og-portrait' => [7, 4, 9, 4], 'og-2bit' => [7, 3, 8, 3]
  }

  cases.each do |scenario, (data, time)|
    devices.each do |name, device|
      next if name == 'og-2bit' && !%w[ordinary five-active].include?(scenario)

      views.each_with_index do |view, index|
        it "renders #{scenario} #{name} #{view}" do
          screen = trmnl.render(view: view, device: device, now: time, data: data)
          FileUtils.mkdir_p('_build/previews')
          image = MiniMagick::Image.read(screen.png_bytes)
          box = screen.box('.view')
          image.crop("#{box.width.round}x#{box.height.round}+#{box.left.round}+#{box.top.round}")
          image.write("_build/previews/#{scenario}-#{name}-#{view}.png")
          expect(screen).to have_no_transform_error
          expect(screen).to have_no_leaked_text
          expect(screen).to have_no_problems
          expect(screen).to have_no_overflow
          expect(screen).to have_no_text_clamped_with_room_to_spare
          expect(screen).to have_no_overlapping_text
          small_text = screen.evaluate(<<~JS)
            (() => {
              const tooSmall = [], minimum = #{device[:model] == 'v2' ? 21 : 16};
              const walker = document.createTreeWalker(document.querySelector('.view'), NodeFilter.SHOW_TEXT);
              for (let node; node = walker.nextNode();) {
                const text = node.textContent.trim(), el = node.parentElement;
                if (!text || el.closest('svg') || !el.getClientRects().length) continue;
                const pixels = parseFloat(getComputedStyle(el).fontSize);
                if (pixels < minimum - 0.1) tooSmall.push({ text, pixels });
              }
              return tooSmall;
            })()
          JS
          expect(small_text).to be_empty
          expect(screen).to have_no_css('footer')
          if view == 'full'
            bottom_reference = name == 'og-portrait' ? box : screen.box('[data-feature]')
            qr = screen.box('.qr-code')
            expect(qr.top + qr.height).to be <= bottom_reference.top + bottom_reference.height + 0.5
          else
            expect(screen).to have_no_css('[data-feature]')
            expect(screen).to have_no_css('.qr-code')
          end
          expect(screen.text.upcase.gsub(/\s+/, '')).to include('ENDS02:00CET') if scenario == 'dst-fallback'
          expect(screen).to have_text('STALE SOURCE') if scenario == 'stale'

          b = screen.result.data.fetch('briefing')
          rows = screen.all('[data-entry]')
          limit = capacities.fetch(name)[index]
          if view == 'full'
            limit -= 1 if b['live'].size <= 1
          elsif b['stale']
            limit -= 1
          end
          if view == 'half_horizontal'
            active = b['live'].take(limit)
            upcoming = b['next'].take(limit)
            expected = active + upcoming
            if expected.any?
              active_column = screen.find('section[aria-label="Active conditions"]')
              upcoming_column = screen.find('section[aria-label="Upcoming conditions"]')
              expect(active_column.all('[data-entry]').map { |row| row['data-active'] }).to eq(['true'] * active.size)
              expect(upcoming_column.all('[data-entry]').map { |row| row['data-active'] }).to eq(['false'] * upcoming.size)
              expect(active_column.text).to include('No active conditions') if active.empty?
              expect(upcoming_column.text).to include('No upcoming conditions') if upcoming.empty?
            end
          else
            expected = (b['live'] + b['next']).take(limit)
          end
          expect(rows.size).to eq(expected.size)
          expect(rows.map { it['data-active'] }).to eq(expected.map { it['active'].to_s })
          rows.zip(expected).each do |row, entry|
            expect(row.text).to include("#{entry['active'] ? 'Ends' : 'Starts'} #{entry['time']}") unless view == 'full'
            next if entry['name'].start_with?('An unfamiliar')

            expect(row.find('[data-condition-name]').text.downcase).to eq(entry['name'].downcase)
          end
          omitted_active = b['live'].size - expected.count { |entry| entry['active'] }
          omitted_next = b['next'].size - expected.count { |entry| !entry['active'] }
          omitted_labels = []
          omitted_labels << "#{omitted_active} active" if omitted_active.positive?
          omitted_labels << "#{omitted_next} upcoming" if omitted_next.positive?
          expect(screen.all('[data-omitted]').map(&:text)).to eq(omitted_labels.empty? ? [] : ["+#{omitted_labels.join(' · ')}"])
          expect(screen.text.downcase).to include(b['status'].downcase) unless b['status'] == 'Schedule ready'
          expect(screen.evaluate("document.querySelectorAll('.view script').length")).to eq(0)
          expect(screen.evaluate("[...document.querySelectorAll('.view img')].every(img => img.complete && img.naturalWidth > 0)")).to be(true)
        end
      end
    end
  end
end
